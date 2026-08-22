import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { createServer, type Plugin } from 'vite';

import type { AppConfig, AppConfigPatch, ColorScheme, NotificationConfig } from '../src/types.ts';
import { DEFAULT_KEY_BINDINGS, type KeyBindings } from '../src/keymap.ts';
import { NATIVE_NOTIFICATION_ACTIVATION_EVENT } from '../src/notification-provider.ts';

type StateSetter<T> = (next: T | ((current: T) => T)) => void;

class HookHarness {
  private cursor = 0;
  private readonly slots: unknown[] = [];
  effects: Array<() => unknown> = [];

  beginRender() {
    this.cursor = 0;
    this.effects = [];
  }

  useState = <T>(initial: T): [T, StateSetter<T>] => {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = initial;
    const setState: StateSetter<T> = (next) => {
      const current = this.slots[index] as T;
      this.slots[index] = typeof next === 'function'
        ? (next as (value: T) => T)(current)
        : next;
    };
    return [this.slots[index] as T, setState];
  };

  useRef = <T>(initial: T): { current: T } => {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = { current: initial };
    return this.slots[index] as { current: T };
  };

  useCallback = <T>(callback: T): T => {
    this.cursor++;
    return callback;
  };

  useMemo = <T>(factory: () => T): T => {
    this.cursor++;
    return factory();
  };

  useEffect = (effect: () => unknown) => {
    this.cursor++;
    this.effects.push(effect);
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function appConfig(colorScheme: ColorScheme, keyBindings: KeyBindings = DEFAULT_KEY_BINDINGS): AppConfig {
  return {
    port: 8642,
    shell: '/bin/zsh',
    scrollback_lines: 10000,
    ring_buffer_bytes: 1024,
    font_family: 'Menlo',
    font_size: 14,
    sidebar_width: 240,
    color_scheme: colorScheme,
    notification: { enabled: false, always: false, min_duration_ms: 0, sound: false, commands: [] },
    state: {
      enabled: true,
      debounce_ms: 120,
      quiescence_ms: 1500,
      bottom_lines: 15,
      notify_on_blocked: true,
      notify_on_idle: false,
      manifest_dir: '',
    },
    confirm_close_running: true,
    copy_on_select: false,
    quit_when_no_tabs: true,
    close_tab_on_clean_exit: false,
    key_bindings: keyBindings,
  };
}

function mockModules(hooks: HookHarness, api: object, emitSessions = false): Plugin {
  const modules = new Map([
    ['./api', 'export const api = globalThis.__webtabinalAppTest.api;'],
    ['./boot', `
      export async function loadInitialConfig(load) {
        try {
          return { ok: true, config: await load() };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      }
      export function bootErrorMessage(error) {
        return error instanceof Error ? error.message : String(error);
      }
    `],
    ['./components/SettingsModal', 'export function SettingsModal() {}'],
    ['./components/Sidebar', 'export function Sidebar() {}'],
    ['./components/TabMemoModal', 'export function TabMemoModal() {}'],
    ['./components/TerminalView', 'export function TerminalView() {}'],
    ['lucide-react', 'export function PanelLeftOpen() { return null; }'],
    ['./notification-provider', `
      export const NATIVE_NOTIFICATION_ACTIVATION_EVENT = 'webtabinal-native-notification-activated';
      export function createNotificationProvider() {
        return {
          async show(request) {
            const harness = globalThis.__webtabinalAppTest;
            // A provider without permission requests no OS notification.
            if (harness.notificationPermission !== 'granted') return;
            harness.shown.push(request);
          },
          async permission() { return globalThis.__webtabinalAppTest.notificationPermission; },
          async requestPermission() { return globalThis.__webtabinalAppTest.notificationPermission; },
        };
      }
    `],
    ['./theme', 'export function useColorScheme() { return {}; }'],
    ['./util', `
      export function cwdBasename(value) { return value; }
      export function isStandalone() { return false; }
      export function sessionBootstrapAction() { return { type: 'none' }; }
    `],
    ['./ws', emitSessions
      ? `
      export class TerminalSocket {
        constructor(opts) {
          globalThis.__webtabinalAppTest.socketOptions = opts;
          opts.onMessage({
            t: 'sessions',
            list: [
              { id: 'a', order: 0, cwd: '/', command: 'zsh', state: 'idle', exit: null, integrated: true, memo: '' },
              { id: 'b', order: 1, cwd: '/', command: 'zsh', state: 'idle', exit: null, integrated: true, memo: '' },
              { id: 'c', order: 2, cwd: '/', command: 'zsh', state: 'idle', exit: null, integrated: true, memo: '' },
            ],
          });
        }
        attach() {}
        close() {}
      }
    `
      : `
      export class TerminalSocket {
        close() {}
      }
    `],
  ]);

  Object.assign(globalThis, {
    __webtabinalAppTest: { hooks, api, shown: [], notificationPermission: 'granted' },
  });

  return {
    name: 'webtabinal-app-test-mocks',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer?.endsWith('/src/App.tsx') && modules.has(source)) {
        return `\0webtabinal-test:${source}`;
      }
    },
    load(id) {
      if (!id.startsWith('\0webtabinal-test:')) return;
      const source = id.slice('\0webtabinal-test:'.length);
      return modules.get(source);
    },
  };
}

type NotifyHarness = {
  shown: Array<{ sid: string; title: string; body: string }>;
  notificationPermission: string;
  socketOptions: { onMessage: (message: unknown) => void };
};

function harness(): NotifyHarness {
  return (globalThis as typeof globalThis & { __webtabinalAppTest: NotifyHarness }).__webtabinalAppTest;
}

test('latest failed color scheme change rolls back to the server-confirmed scheme', async (t) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });

  const hooks = new HookHarness();
  const dark = deferred<AppConfig>();
  const light = deferred<AppConfig>();
  const api = {
    getConfig: async () => appConfig('system'),
    patchConfig: ({ color_scheme }: Partial<AppConfig>) => {
      if (color_scheme === 'dark') return dark.promise;
      if (color_scheme === 'light') return light.promise;
      throw new Error(`unexpected color scheme: ${color_scheme}`);
    },
  };
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '' },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props: Record<string, unknown> }> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>;
    const settings = children.find(
      (child) => child && typeof child === 'object' && child.props && 'colorScheme' in child.props,
    );
    return settings?.props as {
      colorScheme: ColorScheme;
      onColorSchemeChange: (scheme: ColorScheme) => void;
    };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);

  let settings = render();
  assert.equal(settings.colorScheme, 'system');
  settings.onColorSchemeChange('dark');

  settings = render();
  assert.equal(settings.colorScheme, 'dark');
  settings.onColorSchemeChange('light');

  light.reject(new Error('light failed'));
  await new Promise(setImmediate);
  dark.reject(new Error('dark failed'));
  await new Promise(setImmediate);

  settings = render();
  assert.equal(settings.colorScheme, 'system');
});

test('stale successful color scheme syncs UI after a newer failure', async (t) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });

  const hooks = new HookHarness();
  const dark = deferred<AppConfig>();
  const light = deferred<AppConfig>();
  const api = {
    getConfig: async () => appConfig('system'),
    patchConfig: ({ color_scheme }: Partial<AppConfig>) => {
      if (color_scheme === 'dark') return dark.promise;
      if (color_scheme === 'light') return light.promise;
      throw new Error(`unexpected color scheme: ${color_scheme}`);
    },
  };
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '' },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props: Record<string, unknown> }> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>;
    const settings = children.find(
      (child) => child && typeof child === 'object' && child.props && 'colorScheme' in child.props,
    );
    return settings?.props as {
      colorScheme: ColorScheme;
      onColorSchemeChange: (scheme: ColorScheme) => void;
    };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);

  let settings = render();
  assert.equal(settings.colorScheme, 'system');
  settings.onColorSchemeChange('dark');

  settings = render();
  assert.equal(settings.colorScheme, 'dark');
  settings.onColorSchemeChange('light');

  light.reject(new Error('light failed'));
  await new Promise(setImmediate);

  settings = render();
  assert.equal(settings.colorScheme, 'system');

  dark.resolve(appConfig('dark'));
  await new Promise(setImmediate);

  settings = render();
  assert.equal(settings.colorScheme, 'dark');
});

test('settings modal receives the current shell and keeps it after a successful patch', async (t) => {
  const hooks = new HookHarness();
  const api = {
    getConfig: async () => appConfig('system'),
    patchConfig: async (patch: Partial<AppConfig>) => ({ ...appConfig('system'), ...patch }),
  };
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '' },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props: Record<string, unknown> }> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>;
    const settings = children.find(
      (child) => child && typeof child === 'object' && child.props && 'colorScheme' in child.props,
    );
    return settings?.props as {
      shell: string;
      onShellChange: (shell: string) => Promise<void>;
    };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);

  let settings = render();
  assert.equal(settings.shell, '/bin/zsh');
  await settings.onShellChange('/bin/bash');

  settings = render();
  assert.equal(settings.shell, '/bin/bash');
});

test('failed shell patch rolls back and shows the action-error toast', async (t) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });

  const hooks = new HookHarness();
  const api = {
    getConfig: async () => appConfig('system'),
    patchConfig: async () => {
      throw new Error('shell must be an absolute path');
    },
  };
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '' },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props: Record<string, unknown> }> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = tree.props.children as Array<{ props?: Record<string, unknown>; type?: unknown } | false | null>;
    const settings = children.find(
      (child) => child && typeof child === 'object' && child.props && 'colorScheme' in child.props,
    );
    const toast = children.find(
      (child) => child && typeof child === 'object' && child.props?.className === 'toast-error',
    );
    return {
      settings: settings?.props as {
        shell: string;
        onShellChange: (shell: string) => Promise<void>;
      },
      toast: toast?.props as { children?: unknown } | undefined,
    };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);

  let view = render();
  assert.equal(view.settings.shell, '/bin/zsh');
  await assert.rejects(view.settings.onShellChange('bin/zsh'), /shell must be an absolute path/);

  view = render();
  assert.equal(view.settings.shell, '/bin/zsh');
  assert.equal(
    Array.isArray(view.toast?.children) ? view.toast.children[0] : view.toast?.children,
    'shell must be an absolute path',
  );
});

test('notification controls send nested config patches and retain the last persisted values on failure', async (t) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });

  const hooks = new HookHarness();
  let serverConfig = appConfig('system');
  serverConfig.notification.enabled = true;
  const patches: AppConfigPatch[] = [];
  const api = {
    getConfig: async () => serverConfig,
    patchConfig: async (patch: AppConfigPatch) => {
      patches.push(patch);
      if (patch.notification?.always === true) {
        throw new Error('notification update failed');
      }
      serverConfig = {
        ...serverConfig,
        ...patch,
        notification: { ...serverConfig.notification, ...patch.notification },
      };
      return serverConfig;
    },
  };
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '' },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props?: Record<string, unknown> } | false | null> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>;
    const settings = children.find(
      (child) => child && typeof child === 'object' && child.props && 'colorScheme' in child.props,
    );
    const toast = children.find(
      (child) => child && typeof child === 'object' && child.props?.className === 'toast-error',
    );
    return {
      settings: settings?.props as {
        notification: NotificationConfig;
        onNotificationChange: (patch: Partial<NotificationConfig>) => Promise<void>;
      },
      toast: toast?.props as { children?: unknown } | undefined,
    };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);

  let view = render();
  assert.equal(view.settings.notification.enabled, true);
  await view.settings.onNotificationChange({ enabled: false });
  view = render();
  assert.equal(view.settings.notification.enabled, false);
  assert.deepEqual(patches[0], { notification: { enabled: false } });

  await assert.rejects(
    view.settings.onNotificationChange({ always: true }),
    /notification update failed/,
  );
  view = render();
  assert.equal(view.settings.notification.enabled, false);
  assert.equal(view.settings.notification.always, false);
  assert.deepEqual(patches[1], { notification: { always: true } });
  assert.equal(
    Array.isArray(view.toast?.children) ? view.toast.children[0] : view.toast?.children,
    'notification update failed',
  );
});

test('missing notification permission keeps unread state and native activation selects that session', async (t) => {
  const hooks = new HookHarness();
  const cfg = appConfig('system');
  cfg.notification.enabled = true;
  const api = {
    getConfig: async () => cfg,
    patchConfig: async (patch: Partial<AppConfig>) => ({ ...cfg, ...patch }),
  };
  const listeners: Listener[] = [];
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api, true), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });
  harness().notificationPermission = 'denied';

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '', activeElement: null },
    window: {
      addEventListener: (type: string, fn: (event: unknown) => void, opts?: boolean | { capture?: boolean }) => {
        listeners.push({
          type,
          fn,
          capture: opts === true || (typeof opts === 'object' && !!opts.capture),
        });
      },
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
      focus: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props?: Record<string, unknown> } | false | null> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = (tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>)
      .filter((child): child is { props: Record<string, unknown> } => !!child && typeof child === 'object' && !!child.props);
    const sidebar = children.find((child) => 'sessions' in child.props);
    const main = children.find((child) => child.props.className === 'main');
    const mainChildren = main?.props.children as
      | { props?: Record<string, unknown> }
      | Array<{ props?: Record<string, unknown> } | false | null>
      | undefined;
    const terminal = Array.isArray(mainChildren)
      ? mainChildren.find((child) => !!child && typeof child === 'object' && child.props && 'focusSeq' in child.props)
      : mainChildren;
    return {
      activeId: sidebar?.props.activeId as string | null,
      unread: sidebar?.props.unread as Set<string>,
      focusSeq: terminal?.props?.focusSeq as number,
    };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);
  render();

  const socketOptions = (globalThis as typeof globalThis & {
    __webtabinalAppTest: {
      socketOptions: { onMessage: (message: unknown) => void };
    };
  }).__webtabinalAppTest.socketOptions;
  socketOptions.onMessage({
    t: 'notify',
    sid: 'b',
    title: 'Approval needed',
    body: 'Codex is waiting',
  });
  await new Promise(setImmediate);

  let view = render();
  assert.equal(view.activeId, 'a');
  assert.equal(view.unread.has('b'), true, 'missing permission must not suppress unread state');

  const activation = listeners.find((listener) => listener.type === NATIVE_NOTIFICATION_ACTIVATION_EVENT);
  assert.ok(activation, 'native activation listener must be installed');
  activation.fn({ detail: 'b' });

  view = render();
  assert.equal(view.activeId, 'b');
  assert.equal(view.unread.has('b'), false);
  assert.equal(view.focusSeq, 1, 'activation must use the normal selection path and restore terminal focus');
});

test('notification.commands gates banners for both completion and agent events', async (t) => {
  const hooks = new HookHarness();
  const cfg = appConfig('system');
  cfg.notification.enabled = true;
  cfg.notification.always = true;
  cfg.notification.commands = ['claude'];
  const api = {
    getConfig: async () => cfg,
    patchConfig: async (patch: Partial<AppConfig>) => ({ ...cfg, ...patch }),
  };
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api, true), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '', activeElement: null },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
      focus: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props?: Record<string, unknown> } | false | null> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = (tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>)
      .filter((child): child is { props: Record<string, unknown> } => !!child && typeof child === 'object' && !!child.props);
    const sidebar = children.find((child) => 'sessions' in child.props);
    return { unread: sidebar?.props.unread as Set<string> };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);
  render();

  const { socketOptions } = harness();

  // Completion of an unlisted command: unread only, no banner.
  socketOptions.onMessage({
    t: 'state', sid: 'b', cwd: '/tmp', cmd: 'ls', state: 'running', exit: null, integrated: true, run_ms: 0,
  });
  socketOptions.onMessage({
    t: 'state', sid: 'b', cwd: '/tmp', cmd: 'ls', state: 'idle', exit: 0, integrated: true, run_ms: 8,
  });
  await new Promise(setImmediate);
  assert.equal(render().unread.has('b'), true, 'an unlisted completion must still mark the tab unread');
  assert.deepEqual(harness().shown, [], '`ls` must not raise a banner');

  // Completion of a listed command: banner.
  socketOptions.onMessage({
    t: 'state', sid: 'c', cwd: '/tmp', cmd: 'claude', state: 'running', exit: null, integrated: true, run_ms: 0,
  });
  socketOptions.onMessage({
    t: 'state', sid: 'c', cwd: '/tmp', cmd: 'claude', state: 'idle', exit: 0, integrated: true, run_ms: 12,
  });
  await new Promise(setImmediate);
  assert.equal(harness().shown.length, 1, 'a listed completion must raise a banner');
  assert.equal(harness().shown[0].sid, 'c');

  // Re-render so the session list ref sees the commands the state frames set;
  // the real app re-renders on setSessions before any later notify frame.
  render();

  // Agent notify frame on the unlisted session: unread only.
  socketOptions.onMessage({
    t: 'notify', sid: 'b', title: 'make', body: 'build finished',
  });
  await new Promise(setImmediate);
  assert.equal(harness().shown.length, 1, 'an unlisted session must not raise a banner from a notify frame');

  // Agent notify frame on the listed session: banner.
  socketOptions.onMessage({
    t: 'notify', sid: 'c', title: 'Claude Code', body: 'Ready for input', kind: 'agent_idle', source: 'screen',
  });
  await new Promise(setImmediate);
  assert.deepEqual(
    harness().shown.map((r) => [r.sid, r.title, r.body]).slice(1),
    [['c', 'Claude Code', 'Ready for input']],
  );
});

test('agent_state frames update pills without replacing shell state or dropping unread', async (t) => {
  const hooks = new HookHarness();
  const cfg = appConfig('system');
  cfg.notification.enabled = true;
  cfg.notification.always = true;
  const api = {
    getConfig: async () => cfg,
    patchConfig: async (patch: Partial<AppConfig>) => ({ ...cfg, ...patch }),
  };
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api, true), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });
  Object.assign(globalThis, {
    document: { hasFocus: () => false, title: '', activeElement: null },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
      focus: () => {},
    },
  });
  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props?: Record<string, unknown> } | false | null> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = (tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>)
      .filter((child): child is { props: Record<string, unknown> } => !!child && typeof child === 'object' && !!child.props);
    const sidebar = children.find((child) => 'sessions' in child.props);
    return {
      sessions: sidebar?.props.sessions as Array<{ id: string; state: string; agent_state?: string; command: string }>,
      unread: sidebar?.props.unread as Set<string>,
    };
  };
  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);
  render();
  const socketOptions = (globalThis as typeof globalThis & {
    __webtabinalAppTest: { socketOptions: { onMessage: (message: unknown) => void } };
  }).__webtabinalAppTest.socketOptions;

  socketOptions.onMessage({
    t: 'state',
    sid: 'b',
    cwd: '/',
    cmd: 'codex',
    state: 'running',
    exit: null,
    integrated: true,
    run_ms: 10,
  });
  socketOptions.onMessage({
    t: 'agent_state',
    sid: 'b',
    agent: 'codex',
    agent_state: 'blocked',
    agent_state_since: '2026-01-01T00:00:00Z',
    agent_state_signal: 'screen',
  });
  socketOptions.onMessage({
    t: 'notify',
    sid: 'b',
    title: 'Codex',
    body: 'Waiting for input',
    kind: 'agent_blocked',
    source: 'screen',
  });
  await new Promise(setImmediate);
  let view = render();
  const tab = view.sessions.find((s) => s.id === 'b');
  assert.equal(tab?.state, 'running');
  assert.equal(tab?.agent_state, 'blocked');
  assert.equal(tab?.command, 'codex');
  assert.equal(view.unread.has('b'), true);
  assert.deepEqual(view.sessions.map((s) => s.id), ['a', 'b', 'c']);

  socketOptions.onMessage({
    t: 'agent_state',
    sid: 'b',
    agent: 'codex',
    agent_state: 'idle',
    agent_state_since: '2026-01-01T00:00:01Z',
    agent_state_signal: 'osc',
  });
  await new Promise(setImmediate);
  view = render();
  assert.equal(view.sessions.find((s) => s.id === 'b')?.agent_state, 'idle');
  assert.equal(view.unread.has('b'), true, 'unread survives blocked resolution');
  assert.deepEqual(view.sessions.map((s) => s.id), ['a', 'b', 'c']);
});

type Listener = {
  type: string;
  fn: (event: unknown) => void;
  capture: boolean;
};

function keyEvent(init: { key: string; ctrlKey?: boolean; metaKey?: boolean }) {
  const event = {
    key: init.key,
    ctrlKey: !!init.ctrlKey,
    altKey: false,
    shiftKey: false,
    metaKey: !!init.metaKey,
    isComposing: false,
    keyCode: 0,
    defaultPrevented: false,
    stopped: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    stopPropagation() {
      event.stopped = true;
    },
  };
  return event;
}

async function bootChordApp(
  t: { after: (fn: () => Promise<void> | void) => void },
  keyBindings: KeyBindings,
  activeElement: { tagName?: string; className?: string } | null = null,
) {
  const hooks = new HookHarness();
  const api = {
    getConfig: async () => appConfig('system', keyBindings),
    patchConfig: async (patch: Partial<AppConfig>) => ({ ...appConfig('system', keyBindings), ...patch }),
  };
  const listeners: Listener[] = [];
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [mockModules(hooks, api, true), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./app-react-mock.ts', import.meta.url)) },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  Object.assign(globalThis, {
    document: { hasFocus: () => true, title: '', activeElement },
    window: {
      addEventListener: (type: string, fn: (event: unknown) => void, opts?: boolean | { capture?: boolean }) => {
        listeners.push({
          type,
          fn,
          capture: opts === true || (typeof opts === 'object' && !!opts.capture),
        });
      },
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      close: () => {},
    },
  });

  const { default: App } = await server.ssrLoadModule('/src/App.tsx') as {
    default: () => { props: { children: Array<{ props?: Record<string, unknown>; type?: unknown } | false | null> } };
  };
  const render = () => {
    hooks.beginRender();
    const tree = App();
    const children = (tree.props.children as Array<{ props?: Record<string, unknown> } | false | null>)
      .filter((child): child is { props: Record<string, unknown> } => !!child && typeof child === 'object' && !!child.props);
    const sidebar = children.find((child) => 'sessions' in child.props);
    const pending = children.find((child) => child.props.className === 'chord-pending');
    const main = children.find((child) => child.props.className === 'main');
    const mainChildren = (Array.isArray(main?.props.children) ? main.props.children : [main?.props.children])
      .filter((child): child is { props: Record<string, unknown> } => !!child && typeof child === 'object' && !!child.props);
    const expand = mainChildren.find((child) => child.props['aria-label'] === 'サイドバーを開く');
    const terminal = mainChildren.find((child) => 'focusSeq' in child.props);
    return {
      activeId: (sidebar?.props.activeId ?? terminal?.props.sessionId) as string | null | undefined,
      sessions: sidebar?.props.sessions as Array<{ id: string }> | undefined,
      onOpenSettings: sidebar?.props.onOpenSettings as (() => void) | undefined,
      onCollapse: sidebar?.props.onCollapse as (() => void) | undefined,
      pending: pending?.props.children,
      sidebarVisible: !!sidebar,
      onExpand: expand?.props.onClick as (() => void) | undefined,
      focusSeq: terminal?.props.focusSeq as number | undefined,
    };
  };

  render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);
  const view = render();
  const capture = listeners.filter((listener) => listener.type === 'keydown' && listener.capture);
  const bubble = listeners.filter((listener) => listener.type === 'keydown' && !listener.capture);
  assert.equal(capture.length, 1, 'expected one capture-phase keydown listener');
  return { render, capture: capture[0].fn, bubble: bubble[0]?.fn, view };
}

test('enabled prefix chord is consumed and moves to the neighbouring session', async (t) => {
  const enabled = { ...DEFAULT_KEY_BINDINGS, enabled: true };
  const { render, capture } = await bootChordApp(t, enabled);

  const prefix = keyEvent({ key: 'j', ctrlKey: true });
  capture(prefix);
  assert.equal(prefix.defaultPrevented, true);
  assert.equal(prefix.stopped, true);
  let view = render();
  assert.match(String(view.pending), /Ctrl\+J/);
  assert.equal(view.activeId, 'a');

  const next = keyEvent({ key: 'n' });
  capture(next);
  assert.equal(next.defaultPrevented, true);
  view = render();
  assert.equal(view.activeId, 'b');
  assert.equal(view.pending, undefined);

  capture(keyEvent({ key: 'j', ctrlKey: true }));
  const prev = keyEvent({ key: 'p' });
  capture(prev);
  view = render();
  assert.equal(view.activeId, 'a');
});

test('unbound key after the prefix cancels without moving tabs', async (t) => {
  const { render, capture } = await bootChordApp(t, { ...DEFAULT_KEY_BINDINGS, enabled: true });
  capture(keyEvent({ key: 'j', ctrlKey: true }));
  const unbound = keyEvent({ key: 'x' });
  capture(unbound);
  assert.equal(unbound.defaultPrevented, true);
  const view = render();
  assert.equal(view.activeId, 'a');
  assert.equal(view.pending, undefined);
});

test('disabled bindings forward the prefix key', async (t) => {
  const { capture } = await bootChordApp(t, DEFAULT_KEY_BINDINGS);
  const prefix = keyEvent({ key: 'j', ctrlKey: true });
  capture(prefix);
  assert.equal(prefix.defaultPrevented, false);
  assert.equal(prefix.stopped, false);
});

test('sidebar collapse hides the tab list, expands again, and requests terminal focus', async (t) => {
  const { render } = await bootChordApp(t, DEFAULT_KEY_BINDINGS);
  let view = render();
  assert.equal(view.sidebarVisible, true);
  assert.equal(view.onExpand, undefined);
  assert.equal(view.focusSeq, 0);
  assert.equal(typeof view.onCollapse, 'function', 'expanded sidebar must expose onCollapse');

  view.onCollapse?.();
  view = render();
  assert.equal(view.sidebarVisible, false, 'collapse must unmount the sidebar');
  assert.equal(typeof view.onExpand, 'function', 'collapsed pane must show the expand control');
  assert.equal(view.focusSeq, 1, 'collapsing must request terminal focus');
  assert.equal(view.activeId, 'a');

  view.onExpand?.();
  view = render();
  assert.equal(view.sidebarVisible, true);
  assert.equal(view.onExpand, undefined);
  assert.equal(view.focusSeq, 2, 'expanding must request terminal focus');
});

test('Cmd+2 still switches tabs while the sidebar is collapsed', async (t) => {
  const { render, bubble } = await bootChordApp(t, DEFAULT_KEY_BINDINGS);
  assert.equal(typeof bubble, 'function', 'expected a bubble-phase keydown listener');
  render().onCollapse?.();
  let view = render();
  assert.equal(view.sidebarVisible, false);

  const event = keyEvent({ key: '2', metaKey: true });
  bubble?.(event);
  view = render();
  assert.equal(view.activeId, 'b');
  assert.equal(event.defaultPrevented, true);
});

test('chord listener is inert while settings are open or a text field is focused', async (t) => {
  const enabled = { ...DEFAULT_KEY_BINDINGS, enabled: true };
  const modal = await bootChordApp(t, enabled);
  modal.view.onOpenSettings?.();
  modal.render();
  const prefix = keyEvent({ key: 'j', ctrlKey: true });
  modal.capture(prefix);
  assert.equal(prefix.defaultPrevented, false);

  const field = await bootChordApp(t, enabled, { tagName: 'INPUT' });
  const typed = keyEvent({ key: 'j', ctrlKey: true });
  field.capture(typed);
  assert.equal(typed.defaultPrevented, false);
});
