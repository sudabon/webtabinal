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

/**
 * Reports whether a session's command may raise a desktop banner.
 *
 * Matching uses the basename of the command's first token, so `make build` is
 * `make` and `/usr/local/bin/claude --resume` is `claude`. An empty list
 * disables the restriction; suppressing everything is `notification.enabled`.
 * A session whose command is unknown cannot match a non-empty list.
 */
export function commandAllowsNotification(command: string | undefined, commands: string[]): boolean {
  const allowed = commands.map((name) => name.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  const first = (command ?? '').trim().split(/\s+/)[0] ?? '';
  const name = first.slice(first.lastIndexOf('/') + 1);
  if (!name) return false;
  return allowed.includes(name);
}
