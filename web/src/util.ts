export function cwdBasename(cwd: string): string {
  if (!cwd) return '~';
  const normalized = cwd.replace(/\/+$/, '') || '/';
  if (/^\/Users\/[^/]+$/.test(normalized) || /^\/home\/[^/]+$/.test(normalized)) {
    return '~';
  }
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '/';
}

export function formatElapsed(ms?: number): string {
  if (!ms || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return Boolean((window as Window & { __WEBTABINAL_DESKTOP__?: boolean }).__WEBTABINAL_DESKTOP__);
}

export function shouldUseWebglRenderer(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  desktop = typeof window !== 'undefined' &&
    Boolean((window as Window & { __WEBTABINAL_DESKTOP__?: boolean }).__WEBTABINAL_DESKTOP__),
): boolean {
  if (desktop) return false;
  if (/Chrome|Chromium|CriOS/i.test(userAgent)) return true;
  if (/AppleWebKit/i.test(userAgent)) return false;
  return true;
}

export type SessionBootstrapAction =
  | { type: 'create' }
  | { type: 'restart'; id: string }
  | { type: 'none' };

export function sessionBootstrapAction(
  sessions: Array<{ id: string; state: string }>,
  activeId: string | null,
): SessionBootstrapAction {
  if (sessions.length === 0) return { type: 'create' };
  const active = sessions.find((session) => session.id === activeId) ?? sessions[0];
  if (active.state === 'exited') return { type: 'restart', id: active.id };
  return { type: 'none' };
}

export function openExternalLink(uri: string): void {
  window.open(uri, '_blank', 'noopener');
}

export const MAX_MEMO_CODE_POINTS = 30;

export function unicodeLength(value: string): number {
  return Array.from(value).length;
}

/** Clamp to at most `max` Unicode code points (keeps earlier characters). */
export function clampUnicode(value: string, max = MAX_MEMO_CODE_POINTS): string {
  const chars = Array.from(value);
  if (chars.length <= max) return value;
  return chars.slice(0, max).join('');
}

