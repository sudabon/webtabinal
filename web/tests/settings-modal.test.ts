import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

import { DEFAULT_KEY_BINDINGS, type KeyBindings } from '../src/keymap.ts';
import type { NotificationPermissionState } from '../src/notification-provider.ts';
import type { NotificationConfig, StateConfig } from '../src/types.ts';

type StateSetter<T> = (next: T | ((current: T) => T)) => void;

type TreeNode = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

const DEFAULT_STATE: StateConfig = {
  enabled: true,
  debounce_ms: 120,
  quiescence_ms: 1500,
  bottom_lines: 15,
  notify_on_blocked: true,
  manifest_dir: '',
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
      shiftEnterNewline: boolean;
      onShiftEnterNewlineChange: (enabled: boolean) => void | Promise<void>;
      notification: NotificationConfig;
      notificationPermission: NotificationPermissionState;
      onNotificationChange: (patch: Partial<NotificationConfig>) => void | Promise<void>;
      state: StateConfig;
      onStateChange: (patch: Partial<StateConfig>) => void | Promise<void>;
      onNotificationPermissionRefresh: () => Promise<NotificationPermissionState>;
      onNotificationPermissionRequest: () => Promise<NotificationPermissionState>;
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
      shiftEnterNewline: boolean;
      onShiftEnterNewlineChange: (enabled: boolean) => void | Promise<void>;
    }) => TreeNode;
  };
  const { NotificationsSettings } = await server.ssrLoadModule('/src/components/NotificationsSettings.tsx') as {
    NotificationsSettings: (props: {
      notification: NotificationConfig;
      state: StateConfig;
      permissionState: NotificationPermissionState;
      onNotificationChange: (patch: Partial<NotificationConfig>) => void | Promise<void>;
      onStateChange: (patch: Partial<StateConfig>) => void | Promise<void>;
      onPermissionRefresh: () => Promise<NotificationPermissionState>;
      onPermissionRequest: () => Promise<NotificationPermissionState>;
    }) => TreeNode;
  };

  return { SettingsModal, GeneralSettings, AppearanceSettings, KeyboardSettings, NotificationsSettings };
}

test('settings modal opens on Appearance and can switch to General', async (t) => {
  const hooks = new HookHarness();
  const {
    SettingsModal,
    AppearanceSettings,
    GeneralSettings,
    KeyboardSettings,
    NotificationsSettings,
  } = await loadComponents(t, hooks);

  const props = {
    open: true,
    colorScheme: 'system' as const,
    onColorSchemeChange: () => {},
    shell: '/bin/zsh',
    onShellChange: () => {},
    keyBindings: DEFAULT_KEY_BINDINGS,
    onKeyBindingsChange: () => {},
    shiftEnterNewline: true,
    onShiftEnterNewlineChange: () => {},
    notification: { enabled: true, always: false, min_duration_ms: 0, sound: false },
    notificationPermission: 'default' as const,
    onNotificationChange: () => {},
    state: DEFAULT_STATE,
    onStateChange: () => {},
    onNotificationPermissionRefresh: async () => 'default' as const,
    onNotificationPermissionRequest: async () => 'granted' as const,
    onClose: () => {},
  };

  hooks.beginRender();
  let tree = SettingsModal(props);
  assert.ok(tree);

  const navButtons = childrenOf(walk(tree, (n) => n.type === 'nav'));
  assert.deepEqual(
    navButtons.map((button) => (button as TreeNode).props?.children),
    ['外観', '一般', '通知', 'キーボード'],
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

  const notifications = nextButtons[2] as TreeNode;
  (notifications.props?.onClick as () => void)();
  hooks.beginRender();
  tree = SettingsModal(props);
  assert.ok(tree);
  assert.ok(walk(tree, (n) => n.type === NotificationsSettings));
  assert.equal(walk(tree, (n) => n.type === 'h2')?.props?.children, '通知');

  const notificationButtons = childrenOf(walk(tree, (n) => n.type === 'nav'));
  const keyboard = notificationButtons[3] as TreeNode;
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
    return KeyboardSettings({
      bindings: persisted,
      onBindingsChange,
      shiftEnterNewline: true,
      onShiftEnterNewlineChange: () => {},
    });
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

test('notification settings persist immediately and roll back with a visible error', async (t) => {
  const hooks = new HookHarness();
  const { NotificationsSettings } = await loadComponents(t, hooks);
  let persisted: NotificationConfig = {
    enabled: true,
    always: false,
    min_duration_ms: 0,
    sound: false,
  };
  const patches: Array<Partial<NotificationConfig>> = [];
  let finishSave!: () => void;
  const save = new Promise<void>((resolve) => { finishSave = resolve; });
  const onNotificationChange = (patch: Partial<NotificationConfig>) => {
    patches.push(patch);
    if (patch.always === true) throw new Error('設定を保存できませんでした');
    return save.then(() => {
      persisted = { ...persisted, ...patch };
    });
  };
  const render = () => {
    hooks.beginRender();
    return NotificationsSettings({
      notification: persisted,
      state: DEFAULT_STATE,
      permissionState: 'granted',
      onNotificationChange,
      onStateChange: () => {},
      onPermissionRefresh: async () => 'granted',
      onPermissionRequest: async () => 'granted',
    });
  };

  let tree = render();
  const enabled = walk(tree, (node) => node.type === 'input' && node.props?.id === 'notification-enabled');
  assert.equal(enabled?.props?.checked, true);
  (enabled?.props?.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
  assert.deepEqual(patches, [{ enabled: false }], 'config patch must start in the change handler');
  tree = render();
  assert.equal(
    walk(tree, (node) => node.type === 'input' && node.props?.id === 'notification-enabled')?.props?.checked,
    false,
    'control must update while persistence is in flight',
  );

  finishSave();
  await new Promise(setImmediate);
  tree = render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);

  const always = walk(tree, (node) => node.type === 'input' && node.props?.id === 'notification-always');
  (always?.props?.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  await new Promise(setImmediate);

  tree = render();
  assert.deepEqual(patches, [{ enabled: false }, { always: true }]);
  assert.equal(
    walk(tree, (node) => node.type === 'input' && node.props?.id === 'notification-enabled')?.props?.checked,
    false,
    'rollback must retain the last successfully persisted enablement value',
  );
  assert.equal(
    walk(tree, (node) => node.type === 'input' && node.props?.id === 'notification-always')?.props?.checked,
    false,
  );
  assert.equal(
    walk(tree, (node) => node.props?.role === 'alert')?.props?.children,
    '設定を保存できませんでした',
  );
});

test('notification permission is requested directly and refreshed on open and window focus', async (t) => {
  const hooks = new HookHarness();
  const { NotificationsSettings } = await loadComponents(t, hooks);
  const focusListeners: Array<() => void> = [];
  Object.assign(globalThis, {
    window: {
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'focus') focusListeners.push(listener);
      },
      removeEventListener: () => {},
    },
  });

  let externalPermission: NotificationPermissionState = 'default';
  let refreshes = 0;
  let requests = 0;
  const render = () => {
    hooks.beginRender();
    return NotificationsSettings({
      notification: { enabled: true, always: false, min_duration_ms: 0, sound: false },
      state: DEFAULT_STATE,
      permissionState: 'default',
      onNotificationChange: () => {},
      onStateChange: () => {},
      onPermissionRefresh: async () => {
        refreshes += 1;
        return externalPermission;
      },
      onPermissionRequest: async () => {
        requests += 1;
        externalPermission = 'granted';
        return 'granted';
      },
    });
  };

  let tree = render();
  for (const effect of hooks.effects) effect();
  await new Promise(setImmediate);
  assert.equal(refreshes, 1, 'opening the category must query permission once');
  assert.equal(focusListeners.length, 1, 'the open category must observe window focus');

  tree = render();
  assert.equal(
    walk(tree, (node) => node.props?.['data-notification-permission'] === 'default')?.props?.[
      'data-notification-permission'
    ],
    'default',
  );
  const allow = walk(tree, (node) => node.type === 'button' && node.props?.children === '通知を許可');
  assert.ok(allow, 'default permission must offer an action');
  (allow.props?.onClick as () => void)();
  assert.equal(requests, 1, 'permission request must begin in the click handler');
  await new Promise(setImmediate);

  tree = render();
  assert.ok(walk(tree, (node) => node.props?.['data-notification-permission'] === 'granted'));
  assert.equal(walk(tree, (node) => node.type === 'button' && node.props?.children === '通知を許可'), undefined);

  externalPermission = 'denied';
  focusListeners[0]();
  await new Promise(setImmediate);
  tree = render();
  const denied = walk(tree, (node) => node.props?.['data-notification-permission'] === 'denied');
  assert.ok(denied, 'focus refresh must observe an externally denied state');
  assert.match(JSON.stringify(denied), /システム設定/);
  assert.match(JSON.stringify(denied), /ブラウザ/);

  externalPermission = 'unsupported';
  focusListeners[0]();
  await new Promise(setImmediate);
  tree = render();
  assert.ok(walk(tree, (node) => node.props?.['data-notification-permission'] === 'unsupported'));
  assert.match(JSON.stringify(tree), /利用できません/);
  assert.equal(requests, 1, 'denied and unsupported states must not offer another request');
});

test('agent state settings persist, disable dependents, and roll back invalid numbers', async (t) => {
  const hooks = new HookHarness();
  const { NotificationsSettings } = await loadComponents(t, hooks);
  let persistedState: StateConfig = { ...DEFAULT_STATE };
  const persistedNotification: NotificationConfig = {
    enabled: true,
    always: true,
    min_duration_ms: 0,
    sound: false,
  };
  const statePatches: Array<Partial<StateConfig>> = [];
  const render = () => {
    hooks.beginRender();
    return NotificationsSettings({
      notification: persistedNotification,
      state: persistedState,
      permissionState: 'granted',
      onNotificationChange: () => {
        throw new Error('notification must not change');
      },
      onStateChange: (patch) => {
        statePatches.push(patch);
        if (typeof patch.debounce_ms === 'number' && patch.debounce_ms < 20) {
          throw new Error('state.debounce_ms must be between 20 and 5000');
        }
        persistedState = { ...persistedState, ...patch };
      },
      onPermissionRefresh: async () => 'granted',
      onPermissionRequest: async () => 'granted',
    });
  };

  let tree = render();
  assert.ok(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-enabled'));
  const advanced = walk(tree, (node) => node.type === 'button' && String(node.props?.children).includes('詳細設定'));
  assert.ok(advanced);
  (advanced.props?.onClick as () => void)();
  tree = render();
  assert.ok(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-quiescence'));
  assert.match(JSON.stringify(tree), /デーモン再起動後/);
  assert.match(JSON.stringify(tree), /マニフェスト指定があれば/);

  const enabled = walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-enabled');
  (enabled?.props?.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
  await new Promise(setImmediate);
  tree = render();
  assert.equal(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-notify-blocked')?.props?.disabled, true);
  assert.equal(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-quiescence')?.props?.disabled, true);
  assert.equal(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-quiescence')?.props?.value, 1500);

  (walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-enabled')?.props?.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  await new Promise(setImmediate);
  tree = render();
  const quiescence = walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-quiescence');
  assert.equal(quiescence?.props?.disabled, false);
  (quiescence?.props?.onChange as (event: { target: { value: string } }) => void)({ target: { value: '2000' } });
  (quiescence?.props?.onBlur as (event: { target: { value: string } }) => void)({ target: { value: '2000' } });
  await new Promise(setImmediate);
  tree = render();
  assert.equal(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-quiescence')?.props?.value, 2000);

  const debounce = walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-debounce');
  (debounce?.props?.onChange as (event: { target: { value: string } }) => void)({ target: { value: '1' } });
  (debounce?.props?.onBlur as (event: { target: { value: string } }) => void)({ target: { value: '1' } });
  await new Promise(setImmediate);
  tree = render();
  assert.equal(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-debounce')?.props?.value, 120);
  assert.equal(walk(tree, (node) => node.type === 'input' && node.props?.id === 'state-quiescence')?.props?.value, 2000);
  assert.equal(walk(tree, (node) => node.props?.role === 'alert')?.props?.children, 'state.debounce_ms must be between 20 and 5000');
  assert.deepEqual(persistedNotification, { enabled: true, always: true, min_duration_ms: 0, sound: false });
});

test('Shift+Enter newline toggle persists immediately and rolls back with a visible error', async (t) => {
  const hooks = new HookHarness();
  const { KeyboardSettings } = await loadComponents(t, hooks);
  installKeyCapture();
  const committed: boolean[] = [];
  let persisted = true;
  let failNext = false;

  const onShiftEnterNewlineChange = async (enabled: boolean) => {
    committed.push(enabled);
    if (failNext) throw new Error('保存に失敗しました');
    persisted = enabled;
  };

  const render = () => {
    hooks.beginRender();
    return KeyboardSettings({
      bindings: DEFAULT_KEY_BINDINGS,
      onBindingsChange: () => {},
      shiftEnterNewline: persisted,
      onShiftEnterNewlineChange,
    });
  };

  let tree = render();
  const toggle = findByAriaLabel(tree, 'Shift+Enter で改行');
  assert.equal(toggle.props?.checked, true);

  (toggle.props?.onChange as (e: unknown) => void)({ target: { checked: false } });
  await new Promise(setImmediate);
  tree = render();
  assert.deepEqual(committed, [false]);
  assert.equal(findByAriaLabel(tree, 'Shift+Enter で改行').props?.checked, false);

  failNext = true;
  (findByAriaLabel(tree, 'Shift+Enter で改行').props?.onChange as (e: unknown) => void)({
    target: { checked: true },
  });
  await new Promise(setImmediate);
  tree = render();
  assert.deepEqual(committed, [false, true]);
  assert.equal(
    findByAriaLabel(tree, 'Shift+Enter で改行').props?.checked,
    false,
    'a failed save must roll the checkbox back to the persisted value',
  );
  assert.equal(walk(tree, (n) => n.props?.role === 'alert')?.props?.children, '保存に失敗しました');
});
