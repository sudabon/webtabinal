export const NATIVE_NOTIFICATION_ACTIVATION_EVENT = 'webtabinal-native-notification-activated';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export type NotificationRequest = {
  sid: string;
  title: string;
  body: string;
  onActivate?: () => void;
};

export type NotificationProvider = {
  readonly kind: 'native' | 'web' | 'unsupported';
  getPermission: () => Promise<NotificationPermissionState>;
  requestPermission: () => Promise<NotificationPermissionState>;
  show: (request: NotificationRequest) => Promise<boolean>;
};

type NativeNotificationMessage =
  | { operation: 'getPermission' }
  | { operation: 'requestPermission' }
  | { operation: 'show'; sid: string; title: string; body: string };

export type NativeNotificationBridge = {
  postMessage: (message: NativeNotificationMessage) => Promise<unknown>;
};

export type WebNotificationConstructor = {
  readonly permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  new(title: string, options?: NotificationOptions): Notification;
};

export type NotificationProviderEnvironment = {
  desktop: boolean;
  nativeBridge?: NativeNotificationBridge;
  webNotification?: WebNotificationConstructor;
  focusWindow?: () => void;
};

type DesktopWindow = Window & {
  __WEBTABINAL_DESKTOP__?: boolean;
  webkit?: {
    messageHandlers?: {
      webtabinalNotifications?: NativeNotificationBridge;
    };
  };
};

function normalizePermission(value: unknown): NotificationPermissionState {
  if (value === 'default' || value === 'granted' || value === 'denied') return value;
  return 'unsupported';
}

function browserEnvironment(): NotificationProviderEnvironment {
  if (typeof window === 'undefined') return { desktop: false };
  const desktopWindow = window as DesktopWindow;
  return {
    desktop: desktopWindow.__WEBTABINAL_DESKTOP__ === true,
    nativeBridge: desktopWindow.webkit?.messageHandlers?.webtabinalNotifications,
    webNotification: 'Notification' in desktopWindow
      ? desktopWindow.Notification as WebNotificationConstructor
      : undefined,
    focusWindow: () => desktopWindow.focus(),
  };
}

function unsupportedProvider(): NotificationProvider {
  return {
    kind: 'unsupported',
    getPermission: async () => 'unsupported',
    requestPermission: async () => 'unsupported',
    show: async () => false,
  };
}

function nativeProvider(bridge: NativeNotificationBridge): NotificationProvider {
  return {
    kind: 'native',
    getPermission: async () => normalizePermission(
      await bridge.postMessage({ operation: 'getPermission' }),
    ),
    requestPermission: async () => normalizePermission(
      await bridge.postMessage({ operation: 'requestPermission' }),
    ),
    show: async ({ sid, title, body }) => {
      await bridge.postMessage({ operation: 'show', sid, title, body });
      return true;
    },
  };
}

function webProvider(
  NotificationAPI: WebNotificationConstructor,
  focusWindow: () => void,
): NotificationProvider {
  return {
    kind: 'web',
    getPermission: async () => normalizePermission(NotificationAPI.permission),
    requestPermission: async () => {
      const current = normalizePermission(NotificationAPI.permission);
      if (current !== 'default') return current;
      return normalizePermission(await NotificationAPI.requestPermission());
    },
    show: async ({ title, body, onActivate }) => {
      if (NotificationAPI.permission !== 'granted') return false;
      const notification = new NotificationAPI(title, { body });
      notification.onclick = () => {
        focusWindow();
        onActivate?.();
      };
      return true;
    },
  };
}

export function createNotificationProvider(
  environment: NotificationProviderEnvironment = browserEnvironment(),
): NotificationProvider {
  if (environment.desktop) {
    return environment.nativeBridge ? nativeProvider(environment.nativeBridge) : unsupportedProvider();
  }
  if (environment.webNotification) {
    return webProvider(environment.webNotification, environment.focusWindow ?? (() => {}));
  }
  return unsupportedProvider();
}
