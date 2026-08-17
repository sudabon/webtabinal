import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNotificationProvider,
  type NativeNotificationBridge,
  type WebNotificationConstructor,
} from '../src/notification-provider.ts';

function fakeWebNotifications(initialPermission: NotificationPermission) {
  const shown: Array<{ title: string; body: string | undefined }> = [];
  const instances: FakeNotification[] = [];

  class FakeNotification {
    static permission = initialPermission;
    static requestPermission = async () => FakeNotification.permission;

    onclick: ((event: Event) => void) | null = null;

    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, body: options?.body });
      instances.push(this);
    }
  }

  return {
    api: FakeNotification as unknown as WebNotificationConstructor,
    shown,
    instances,
  };
}

test('native desktop delivery never constructs a Web Notification', async () => {
  const messages: unknown[] = [];
  const bridge: NativeNotificationBridge = {
    postMessage: async (message) => {
      messages.push(message);
      return message.operation === 'getPermission' ? 'granted' : true;
    },
  };
  const web = fakeWebNotifications('granted');
  const provider = createNotificationProvider({
    desktop: true,
    nativeBridge: bridge,
    webNotification: web.api,
  });

  assert.equal(provider.kind, 'native');
  assert.equal(await provider.getPermission(), 'granted');
  assert.equal(await provider.show({ sid: 'session-1', title: 'Done', body: 'codex' }), true);
  assert.deepEqual(messages, [
    { operation: 'getPermission' },
    { operation: 'show', sid: 'session-1', title: 'Done', body: 'codex' },
  ]);
  assert.deepEqual(web.shown, []);
});

test('native desktop without its bridge is unsupported instead of falling back to Web Notifications', async () => {
  const web = fakeWebNotifications('granted');
  const provider = createNotificationProvider({ desktop: true, webNotification: web.api });

  assert.equal(provider.kind, 'unsupported');
  assert.equal(await provider.getPermission(), 'unsupported');
  assert.equal(await provider.show({ sid: 'session-1', title: 'Done', body: 'codex' }), false);
  assert.deepEqual(web.shown, []);
});

test('web delivery requires granted permission and activates through its callback', async () => {
  const web = fakeWebNotifications('default');
  let focused = 0;
  let activated = 0;
  const provider = createNotificationProvider({
    desktop: false,
    webNotification: web.api,
    focusWindow: () => { focused += 1; },
  });

  const request = {
    sid: 'session-1',
    title: 'Done',
    body: 'codex',
    onActivate: () => { activated += 1; },
  };
  assert.equal(await provider.show(request), false);
  assert.deepEqual(web.shown, []);

  (web.api as unknown as { permission: NotificationPermission }).permission = 'granted';
  assert.equal(await provider.show(request), true);
  assert.deepEqual(web.shown, [{ title: 'Done', body: 'codex' }]);

  web.instances[0].onclick?.(new Event('click'));
  assert.equal(focused, 1);
  assert.equal(activated, 1);
});

test('permission requests only prompt while the web state is default', async () => {
  const web = fakeWebNotifications('default');
  let requests = 0;
  web.api.requestPermission = async () => {
    requests += 1;
    return 'denied';
  };
  const provider = createNotificationProvider({ desktop: false, webNotification: web.api });

  assert.equal(await provider.getPermission(), 'default');
  assert.equal(await provider.requestPermission(), 'denied');
  assert.equal(requests, 1);

  (web.api as unknown as { permission: NotificationPermission }).permission = 'denied';
  assert.equal(await provider.requestPermission(), 'denied');
  assert.equal(requests, 1);
});
