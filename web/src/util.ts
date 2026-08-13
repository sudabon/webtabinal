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
