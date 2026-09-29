export function shouldForwardTerminalInput(sessionId: string | null, replaying: boolean): boolean {
  return sessionId != null && sessionId !== '' && !replaying;
}

export type TerminalKeyEvent = {
  type: string;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

// ESC + CR. xterm encodes both Enter and Shift+Enter as a bare CR, so agent CLIs
// (Claude Code, cursor-agent, ...) cannot tell them apart and submit on either.
// This is the sequence `claude /terminal-setup` installs into VSCode/Alacritty/Zed,
// and cursor-agent accepts it as meta+return, so both read it as insert-newline.
export const SHIFT_ENTER_SEQUENCE = '\x1b\r';

export function yenBackslashSequence(ev: TerminalKeyEvent): string | null {
  if (ev.type !== 'keydown' || ev.key !== '¥') return null;
  if (ev.ctrlKey || ev.altKey || ev.metaKey) return null;
  if (ev.isComposing || ev.keyCode === 229) return null;
  // Rewrite the typed key only; pasted text and PTY output keep their yen signs.
  return '\\';
}

export function shiftEnterSequence(ev: TerminalKeyEvent, enabled: boolean): string | null {
  if (!enabled) return null;
  // attachCustomKeyEventHandler also sees keypress/keyup; only keydown must send.
  if (ev.type !== 'keydown') return null;
  if (ev.key !== 'Enter') return null;
  if (!ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) return null;
  // Enter that confirms an IME candidate (Japanese etc.) belongs to the composition.
  if (ev.isComposing || ev.keyCode === 229) return null;
  return SHIFT_ENTER_SEQUENCE;
}
