import type { ServerMsg, SessionInfo } from './types';

export function applyServerMessage(
  sessions: SessionInfo[],
  msg: ServerMsg | { t: string; [key: string]: unknown },
): SessionInfo[] {
  if (msg.t === 'sessions' && Array.isArray((msg as { list?: unknown }).list)) {
    return (msg as { list: SessionInfo[] }).list;
  }
  if (msg.t === 'state') {
    const stateMsg = msg as Extract<ServerMsg, { t: 'state' }>;
    return sessions.map((session) => {
      if (session.id !== stateMsg.sid) return session;
      return {
        ...session,
        cwd: stateMsg.cwd,
        command: stateMsg.cmd,
        state: stateMsg.state,
        exit: stateMsg.exit,
        integrated: stateMsg.integrated,
        run_ms: stateMsg.run_ms,
      };
    });
  }
  if (msg.t === 'agent_state') {
    const agentMsg = msg as Extract<ServerMsg, { t: 'agent_state' }> & Record<string, unknown>;
    return sessions.map((session) => {
      if (session.id !== agentMsg.sid) return session;
      const rest: Record<string, unknown> = { ...agentMsg };
      delete rest.t;
      delete rest.sid;
      return { ...session, ...rest, agent_state: agentMsg.agent_state };
    });
  }
  return sessions;
}
