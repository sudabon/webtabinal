import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

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

  return { SettingsModal, GeneralSettings, AppearanceSettings };
}

test('settings modal opens on Appearance and can switch to General', async (t) => {
  const hooks = new HookHarness();
  const { SettingsModal, AppearanceSettings, GeneralSettings } = await loadComponents(t, hooks);

  const props = {
    open: true,
    colorScheme: 'system' as const,
    onColorSchemeChange: () => {},
    shell: '/bin/zsh',
    onShellChange: () => {},
    onClose: () => {},
  };

  hooks.beginRender();
  let tree = SettingsModal(props);
  assert.ok(tree);

  const navButtons = childrenOf(walk(tree, (n) => n.type === 'nav'));
  assert.deepEqual(
    navButtons.map((button) => (button as TreeNode).props?.children),
    ['外観', '一般'],
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
