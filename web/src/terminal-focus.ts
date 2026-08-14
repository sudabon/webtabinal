export function shouldApplyTerminalFocus(opts: {
  settingsOpen: boolean;
  memoOpen: boolean;
}): boolean {
  return !opts.settingsOpen && !opts.memoOpen;
}
