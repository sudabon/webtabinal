export function shouldRaiseDesktopNotification(opts: {
  enabled: boolean;
  always: boolean;
  active: boolean;
  focused: boolean;
  minDurationMs?: number;
  runMs?: number;
}): boolean {
  if (!opts.enabled) return false;
  if (!opts.always && opts.active && opts.focused) return false;
  if ((opts.minDurationMs ?? 0) > 0 && (opts.runMs ?? 0) < (opts.minDurationMs ?? 0)) return false;
  return true;
}

export function agentWaitContent(
  title: string,
  body: string,
  command?: string,
): { title: string; body: string } | null {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle && !trimmedBody) return null;
  return {
    title: trimmedTitle || command?.trim() || 'WebTabinal',
    body: trimmedBody,
  };
}
