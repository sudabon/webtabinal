import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { createServer, type Plugin } from 'vite';

import type { AppConfig, ColorScheme } from '../src/types.ts';

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

function appConfig(colorScheme: ColorScheme): AppConfig {
  return {
    port: 8642,
    shell: '/bin/zsh',
    scrollback_lines: 10000,
    ring_buffer_bytes: 1024,
    font_family: 'Menlo',
    font_size: 14,
    sidebar_width: 240,
    color_scheme: colorScheme,
    notification: { enabled: false, always: false, min_duration_ms: 0, sound: false },
    confirm_close_running: true,
    copy_on_select: false,
    quit_when_no_tabs: true,
    close_tab_on_clean_exit: false,
  };
}

function mockModules(hooks: HookHarness, api: object): Plugin {
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
    ['./theme', 'export function useColorScheme() { return {}; }'],
    ['./util', `
      export function cwdBasename(value) { return value; }
      export function isStandalone() { return false; }
      export function sessionBootstrapAction() { return { type: 'none' }; }
    `],
    ['./ws', `
      export class TerminalSocket {
        close() {}
      }
    `],
  ]);

  Object.assign(globalThis, { __webtabinalAppTest: { hooks, api } });

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
