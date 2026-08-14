import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

import { DEFAULT_KEY_BINDINGS, type KeyBindings } from '../src/keymap.ts';

type StateSetter<T> = (next: T | ((current: T) => T)) => void;

type TreeNode = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

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

function childrenOf(node: TreeNode | undefined): unknown[] {
  const children = node?.props?.children;
  if (children == null) return [];
  return Array.isArray(children) ? children : [children];
}

function walk(node: unknown, visit: (n: TreeNode) => boolean | void): TreeNode | undefined {
  if (!node || typeof node !== 'object') return;
  const n = node as TreeNode;
  if (visit(n) === true) return n;
  for (const child of childrenOf(n)) {
    const found = walk(child, visit);
    if (found) return found;
  }
}

function findInput(tree: unknown): {
  value: string;
  placeholder: string;
  className: string;
  onChange: (event: { target: { value: string } }) => void;
  onBlur: () => void;
  onKeyDown: (event: {
    key: string;
    keyCode: number;
    preventDefault: () => void;
    nativeEvent: { isComposing: boolean };
  }) => void;
} {
  const input = walk(tree, (n) => n.type === 'input' && n.props?.['aria-label'] === '起動シェル');
  assert.ok(input?.props, 'missing shell input');
  return input.props as ReturnType<typeof findInput>;
}

async function loadComponents(t: { after: (fn: () => Promise<void> | void) => void }, hooks: HookHarness) {
  Object.assign(globalThis, {
    __webtabinalAppTest: { hooks },
    document: { hasFocus: () => true, title: '', activeElement: null },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });

  const reactMock = fileURLToPath(new URL('./app-react-mock.ts', import.meta.url));
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: reactMock },
        { find: /^react\/jsx-dev-runtime$/, replacement: reactMock },
        { find: /^react\/jsx-runtime$/, replacement: reactMock },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });

  const { SettingsModal } = await server.ssrLoadModule('/src/components/SettingsModal.tsx') as {
    SettingsModal: (props: {
      open: boolean;
      colorScheme: 'system';
      onColorSchemeChange: () => void;
      shell: string;
      onShellChange: (shell: string) => void | Promise<void>;
      keyBindings: KeyBindings;
      onKeyBindingsChange: (bindings: KeyBindings) => void | Promise<void>;
      onClose: () => void;
    }) => TreeNode | null;
  };
  const { GeneralSettings } = await server.ssrLoadModule('/src/components/GeneralSettings.tsx') as {
    GeneralSettings: (props: {
      shell: string;
      onShellChange: (shell: string) => void | Promise<void>;
    }) => TreeNode;
  };
  const { AppearanceSettings } = await server.ssrLoadModule('/src/components/AppearanceSettings.tsx') as {
    AppearanceSettings: (props: unknown) => TreeNode;
  };
  const { KeyboardSettings } = await server.ssrLoadModule('/src/components/KeyboardSettings.tsx') as {
    KeyboardSettings: (props: {
      bindings: KeyBindings;
      onBindingsChange: (bindings: KeyBindings) => void | Promise<void>;
    }) => TreeNode;
  };

  return { SettingsModal, GeneralSettings, AppearanceSettings, KeyboardSettings };
}

test('settings modal opens on Appearance and can switch to General', async (t) => {
  const hooks = new HookHarness();
  const { SettingsModal, AppearanceSettings, GeneralSettings, KeyboardSettings } = await loadComponents(t, hooks);

  const props = {
    open: true,
    colorScheme: 'system' as const,
    onColorSchemeChange: () => {},
    shell: '/bin/zsh',
    onShellChange: () => {},
    keyBindings: DEFAULT_KEY_BINDINGS,
    onKeyBindingsChange: () => {},
    onClose: () => {},
  };

  hooks.beginRender();
  let tree = SettingsModal(props);
  assert.ok(tree);

  const navButtons = childrenOf(walk(tree, (n) => n.type === 'nav'));
  assert.deepEqual(
    navButtons.map((button) => (button as TreeNode).props?.children),
    ['外観', '一般', 'キーボード'],
  );
  assert.equal((navButtons[0] as TreeNode).props?.className, 'settings-nav-item active');
  assert.equal((navButtons[1] as TreeNode).props?.className, 'settings-nav-item');
  assert.ok(walk(tree, (n) => n.type === AppearanceSettings));
  assert.equal(walk(tree, (n) => n.type === GeneralSettings), undefined);

  const general = navButtons[1] as TreeNode;
  (general.props?.onClick as () => void)();

  hooks.beginRender();
  tree = SettingsModal(props);
  assert.ok(tree);
  const nextButtons = childrenOf(walk(tree, (n) => n.type === 'nav'));
  assert.equal((nextButtons[0] as TreeNode).props?.className, 'settings-nav-item');
  assert.equal((nextButtons[1] as TreeNode).props?.className, 'settings-nav-item active');
  assert.ok(walk(tree, (n) => n.type === GeneralSettings));
  assert.equal(walk(tree, (n) => n.type === AppearanceSettings), undefined);
  const heading = walk(tree, (n) => n.type === 'h2');
  assert.equal(heading?.props?.children, '一般');

  const keyboard = nextButtons[2] as TreeNode;
  (keyboard.props?.onClick as () => void)();
  hooks.beginRender();
  tree = SettingsModal(props);
  assert.ok(tree);
  assert.ok(walk(tree, (n) => n.type === KeyboardSettings));
  assert.equal(walk(tree, (n) => n.type === GeneralSettings), undefined);
  assert.equal(walk(tree, (n) => n.type === 'h2')?.props?.children, 'キーボード');
});

test('shell field shows the current path, commits on blur and Enter, and skips unchanged values', async (t) => {
  const hooks = new HookHarness();
  const { GeneralSettings } = await loadComponents(t, hooks);
  const committed: string[] = [];
  const onShellChange = (shell: string) => {
    committed.push(shell);
  };

  const render = () => {
    hooks.beginRender();
    return GeneralSettings({ shell: '/bin/zsh', onShellChange });
  };

  const tree = render();
  let input = findInput(tree);
  assert.equal(input.value, '/bin/zsh');
  assert.match(input.placeholder, /\/bin\/zsh/);
  assert.match(input.placeholder, /\/bin\/bash/);
  assert.equal(input.className, 'settings-input');
  const hint = walk(tree, (n) => n.type === 'p' && n.props?.id === 'settings-shell-hint');
  assert.match(String(hint?.props?.children ?? ''), /zsh/);
  assert.match(String(hint?.props?.children ?? ''), /bash/);
  assert.match(String(hint?.props?.children ?? ''), /新しいタブ/);

  input.onBlur();
  await new Promise(setImmediate);
  assert.deepEqual(committed, []);

  input.onChange({ target: { value: '/bin/bash' } });
  input = findInput(render());
  assert.equal(input.value, '/bin/bash');
  input.onBlur();
  await new Promise(setImmediate);
  assert.deepEqual(committed, ['/bin/bash']);

  input = findInput(render());
  input.onKeyDown({
    key: 'Enter',
    keyCode: 13,
    preventDefault: () => {},
    nativeEvent: { isComposing: false },
  });
  await new Promise(setImmediate);
  assert.deepEqual(committed, ['/bin/bash']);

  input.onChange({ target: { value: '/opt/homebrew/bin/bash' } });
  input = findInput(render());
  input.onKeyDown({
    key: 'Enter',
    keyCode: 13,
    preventDefault: () => {},
    nativeEvent: { isComposing: false },
  });
  await new Promise(setImmediate);
  assert.deepEqual(committed, ['/bin/bash', '/opt/homebrew/bin/bash']);
});

test('invalid shell path rolls back to the last persisted value', async (t) => {
  const hooks = new HookHarness();
  const { GeneralSettings } = await loadComponents(t, hooks);
  const onShellChange = async () => {
    throw new Error('shell must be an absolute path');
  };

  const render = () => {
    hooks.beginRender();
    return GeneralSettings({ shell: '/bin/zsh', onShellChange });
  };

  let input = findInput(render());
  input.onChange({ target: { value: 'bin/zsh' } });
  input = findInput(render());
  input.onBlur();
  await new Promise(setImmediate);

  input = findInput(render());
  assert.equal(input.value, '/bin/zsh');
});

function findByAriaLabel(tree: unknown, label: string): TreeNode {
  const node = walk(tree, (n) => n.props?.['aria-label'] === label);
  assert.ok(node, `missing control labelled ${label}`);
  return node;
}

function installKeyCapture() {
  const listeners: Array<{ type: string; fn: (event: unknown) => void; capture: boolean }> = [];
  const win = globalThis.window as {
    addEventListener: (type: string, fn: (event: unknown) => void, opts?: boolean | { capture?: boolean }) => void;
    removeEventListener: () => void;
  };
  win.addEventListener = (type, fn, opts) => {
    listeners.push({
      type,
      fn,
      capture: opts === true || (typeof opts === 'object' && !!opts.capture),
    });
  };
  win.removeEventListener = () => {};
  return listeners;
}

test('keyboard settings show current bindings, persist recording, roll back invalid keys, and reset', async (t) => {
  const hooks = new HookHarness();
  const { KeyboardSettings } = await loadComponents(t, hooks);
  const listeners = installKeyCapture();
  const committed: KeyBindings[] = [];
  let persisted: KeyBindings = {
    enabled: true,
    prefix: 'ctrl+j',
    next_tab: 'n',
    prev_tab: 'p',
  };
  const onBindingsChange = (bindings: KeyBindings) => {
    committed.push(bindings);
    persisted = bindings;
  };

  const render = () => {
    hooks.beginRender();
    return KeyboardSettings({ bindings: persisted, onBindingsChange });
  };

  let tree = render();
  assert.equal(findByAriaLabel(tree, 'プレフィックスキー').props?.children, 'Ctrl+J');
  assert.equal(findByAriaLabel(tree, '次のタブ').props?.children, 'N');
  assert.equal(findByAriaLabel(tree, '前のタブ').props?.children, 'P');
  assert.equal(findByAriaLabel(tree, 'タブ移動ショートカット').props?.checked, true);

  (findByAriaLabel(tree, '次のタブ').props?.onClick as () => void)();
  tree = render();
  for (const effect of hooks.effects) effect();
  assert.equal(findByAriaLabel(tree, '次のタブ').props?.children, 'キーを入力…');
  const capture = listeners.find((listener) => listener.type === 'keydown' && listener.capture);
  assert.ok(capture, 'recording must install a capture listener');
  capture.fn({
    key: 'j',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    isComposing: false,
    keyCode: 0,
    preventDefault() {},
    stopPropagation() {},
  });
  await new Promise(setImmediate);
  tree = render();
  assert.equal(findByAriaLabel(tree, '次のタブ').props?.children, 'J');
  assert.deepEqual(committed, [{ enabled: true, prefix: 'ctrl+j', next_tab: 'j', prev_tab: 'p' }]);

  (findByAriaLabel(tree, '前のタブ').props?.onClick as () => void)();
  tree = render();
  for (const effect of hooks.effects) effect();
  const recapture = listeners.filter((listener) => listener.type === 'keydown' && listener.capture).at(-1);
  recapture?.fn({
    key: 'j',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    isComposing: false,
    keyCode: 0,
    preventDefault() {},
    stopPropagation() {},
  });
  await new Promise(setImmediate);
  tree = render();
  assert.equal(findByAriaLabel(tree, '前のタブ').props?.children, 'P');
  assert.equal(walk(tree, (n) => n.props?.role === 'alert')?.props?.children, '次タブと前タブに同じキーは使えません');
  assert.equal(committed.length, 1);

  (findByAriaLabel(tree, 'キー割り当てをリセット').props?.onClick as () => void)();
  await new Promise(setImmediate);
  tree = render();
  assert.equal(findByAriaLabel(tree, 'プレフィックスキー').props?.children, 'Ctrl+J');
  assert.equal(findByAriaLabel(tree, '次のタブ').props?.children, 'N');
  assert.equal(findByAriaLabel(tree, '前のタブ').props?.children, 'P');
  assert.equal(findByAriaLabel(tree, 'タブ移動ショートカット').props?.checked, true);
  assert.deepEqual(committed.at(-1), { enabled: true, prefix: 'ctrl+j', next_tab: 'n', prev_tab: 'p' });
});
