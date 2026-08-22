import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { createServer, type Plugin } from 'vite';

import type { AppConfig } from '../src/types.ts';

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

type ImageHarness = {
  throwOnConstruct: boolean;
  constructed: unknown[];
  loaded: string[];
  terminals: Array<{
    options: Record<string, unknown>;
    onDataHandler: ((data: string) => void) | null;
  }>;
  inputs: Array<{ sid: string; data: string }>;
  wsListeners: Array<(event: { detail: unknown }) => void>;
  useWebgl: boolean;
};

function imageHarness(): ImageHarness {
  return (globalThis as typeof globalThis & { __imageAddonTest: ImageHarness }).__imageAddonTest;
}

function mockTerminalView(hooks: HookHarness, useWebgl: boolean): Plugin {
  const modules = new Map([
    ['../theme', 'export function xtermViewOptions() { return { theme: {}, minimumContrastRatio: 1 }; }'],
    ['../clipboard', `
      export function applyClipboardShortcut() { return 'ignore'; }
      export function clipboardShortcutAction() { return 'ignore'; }
      export function installTerminalClipboardFacade() { return () => {}; }
      export function isTextFieldElement() { return false; }
      export function postDesktopClipboardRead() {}
      export function requestClipboardPaste() {}
    `],
    ['../util', `
      export function openExternalLink() {}
      export function shouldUseWebglRenderer() { return globalThis.__imageAddonTest.useWebgl; }
    `],
    ['../ws', `
      export function decodeB64Bytes(data) {
        if (!data) return new Uint8Array();
        return new Uint8Array(Buffer.from(data, 'base64'));
      }
    `],
  ]);

  Object.assign(globalThis, {
    __imageAddonTest: {
      hooks,
      useWebgl,
      throwOnConstruct: false,
      constructed: [],
      loaded: [],
      terminals: [],
      inputs: [],
      wsListeners: [],
    },
    __webtabinalAppTest: { hooks },
  });

  return {
    name: 'webtabinal-terminal-image-mocks',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer?.includes('/src/components/TerminalView.tsx') && modules.has(source)) {
        return `\0webtabinal-image-test:${source}`;
      }
    },
    load(id) {
      if (!id.startsWith('\0webtabinal-image-test:')) return;
      return modules.get(id.slice('\0webtabinal-image-test:'.length));
    },
  };
}

const config: AppConfig = {
  port: 8642,
  shell: '/bin/zsh',
  scrollback_lines: 10000,
  ring_buffer_bytes: 1024,
  font_family: 'Menlo',
  font_size: 14,
  sidebar_width: 240,
  color_scheme: 'system',
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
  key_bindings: {
    enabled: false,
    prefix: 'ctrl+j',
    next_tab: 'n',
    prev_tab: 'p',
    toggle_sidebar: 'j',
  },
};

async function mountTerminalView(
  t: { after: (fn: () => Promise<void> | void) => void },
  opts: { throwOnConstruct?: boolean; useWebgl?: boolean } = {},
) {
  const hooks = new HookHarness();
  const reactMock = fileURLToPath(new URL('./terminal-image-react-mock.ts', import.meta.url));
  const xtermDoubles = fileURLToPath(new URL('./xterm-test-doubles.ts', import.meta.url));
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [mockTerminalView(hooks, !!opts.useWebgl), react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: reactMock },
        { find: /^react\/jsx-dev-runtime$/, replacement: reactMock },
        { find: /^react\/jsx-runtime$/, replacement: reactMock },
        { find: '@xterm/xterm/css/xterm.css', replacement: xtermDoubles },
        { find: '@xterm/xterm', replacement: xtermDoubles },
        { find: '@xterm/addon-fit', replacement: xtermDoubles },
        { find: '@xterm/addon-search', replacement: xtermDoubles },
        { find: '@xterm/addon-web-links', replacement: xtermDoubles },
        { find: '@xterm/addon-webgl', replacement: xtermDoubles },
        { find: '@xterm/addon-image', replacement: xtermDoubles },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  const harness = imageHarness();
  harness.throwOnConstruct = !!opts.throwOnConstruct;

  const socket = {
    attach() {},
    resize() {},
    input(sid: string, data: string) {
      harness.inputs.push({ sid, data });
    },
  };

  Object.assign(globalThis, {
    document: { activeElement: null },
    window: {
      addEventListener: (type: string, fn: (event: { detail: unknown }) => void) => {
        if (type === 'webtabinal-ws') harness.wsListeners.push(fn);
      },
      removeEventListener: () => {},
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });

  const { TerminalView } = await server.ssrLoadModule('/src/components/TerminalView.tsx') as {
    TerminalView: (props: Record<string, unknown>) => unknown;
  };

  hooks.beginRender();
  TerminalView({
    sessionId: 'sid',
    socket,
    config,
    copyOnSelect: false,
    shiftEnterNewline: true,
    theme: { theme: {}, minimumContrastRatio: 1 },
    focusSeq: 0,
    settingsOpen: false,
    memoOpen: false,
  });
  for (const effect of hooks.effects) effect();
  return harness;
}

test('TerminalView loads ImageAddon after open and the other addons', async (t) => {
  const harness = await mountTerminalView(t, { useWebgl: true });
  assert.deepEqual(harness.loaded, ['fit', 'search', 'links', 'open', 'webgl', 'image']);
  assert.equal(harness.constructed.length, 1);
  assert.deepEqual(harness.constructed[0], {
    kittySupport: true,
    enableSizeReports: true,
    sixelSupport: true,
    iipSupport: true,
  });
  assert.equal(harness.terminals[0]?.options.allowProposedApi, true);
});

test('ImageAddon construct failure is observable and does not load the addon', async (t) => {
  const warnings: unknown[][] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  t.after(() => {
    console.warn = original;
  });

  const harness = await mountTerminalView(t, { throwOnConstruct: true });
  assert.equal(harness.loaded.includes('image'), false);
  assert.equal(warnings.length, 1, 'ImageAddon failure must be logged');
  assert.match(String(warnings[0][0]), /ImageAddon/);
});

test('ImageAddon onData after replay is forwarded to the socket', async (t) => {
  const harness = await mountTerminalView(t);
  assert.equal(harness.wsListeners.length, 1);
  harness.wsListeners[0]({ detail: { t: 'replay', sid: 'sid', data: '', done: true } });
  harness.terminals[0]?.onDataHandler?.('\x1b_Gi=4207;OK\x1b\\');
  assert.deepEqual(harness.inputs, [{ sid: 'sid', data: '\x1b_Gi=4207;OK\x1b\\' }]);
});
