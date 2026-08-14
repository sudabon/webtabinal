export function shouldForwardTerminalInput(sessionId: string | null, replaying: boolean): boolean {
  return sessionId != null && sessionId !== '' && !replaying;
}
