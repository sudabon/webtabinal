import type { AgentState } from '../types';

const AGENT_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  generic: 'Generic TUI',
};

export function agentDisplayName(id: string | undefined): string {
  if (!id) return 'Agent';
  return AGENT_LABELS[id] ?? id;
}

export function agentStateLabel(agent: string | undefined, state: AgentState | string | undefined): string {
  if (!state || state === 'none') return '';
  return `${agentDisplayName(agent)} ${state}`;
}

type Props = {
  agent?: string;
  state?: AgentState | string;
};

export function AgentStatePill({ agent, state }: Props) {
  if (!state || state === 'none') return null;
  const label = agentStateLabel(agent, state);
  return (
    <span className={`agent-pill agent-pill-${state}`} aria-label={label} title={label}>
      {state === 'working' ? <span className="agent-pill-spinner" aria-hidden /> : null}
      <span className="agent-pill-text">{state}</span>
    </span>
  );
}
