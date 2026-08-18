import assert from 'node:assert/strict';
import test from 'node:test';

import { applyServerMessage } from '../src/session-state.ts';
import type { SessionInfo } from '../src/types.ts';

function session(partial: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: 's1',
    order: 0,
    cwd: '/tmp',
    command: 'zsh',
    state: 'idle',
    exit: null,
    integrated: true,
    memo: '',
    ...partial,
  };
}

test('sessions snapshot restores agent state', () => {
  const list = [
    session({
      id: 'blocked',
      command: 'codex',
      agent: 'codex',
      agent_state: 'blocked',
      agent_state_since: '2026-01-01T00:00:00Z',
      agent_state_signal: 'screen',
    }),
  ];
  const next = applyServerMessage([session()], { t: 'sessions', list });
  assert.equal(next[0].agent_state, 'blocked');
  assert.equal(next[0].agent, 'codex');
});

test('agent_state updates one session without replacing shell state', () => {
  const prev = [
    session({ id: 's1', state: 'running', command: 'codex', extra: 'keep' } as SessionInfo & { extra: string }),
    session({ id: 's2', agent_state: 'idle', agent: 'claude' }),
  ];
  const next = applyServerMessage(prev, {
    t: 'agent_state',
    sid: 's1',
    agent: 'codex',
    agent_state: 'blocked',
    agent_state_since: '2026-01-01T00:00:00Z',
    agent_state_signal: 'screen',
    diagnostic: 'pattern=ask',
  } as never);
  assert.equal(next[0].state, 'running');
  assert.equal(next[0].command, 'codex');
  assert.equal(next[0].agent_state, 'blocked');
  assert.equal((next[0] as SessionInfo & { extra?: string }).extra, 'keep');
  assert.equal((next[0] as SessionInfo & { diagnostic?: string }).diagnostic, 'pattern=ask');
  assert.equal(next[1].agent_state, 'idle');
});

test('duplicate agent_state is idempotent', () => {
  const prev = [session({ agent: 'codex', agent_state: 'working' })];
  const msg = {
    t: 'agent_state' as const,
    sid: 's1',
    agent: 'codex',
    agent_state: 'working' as const,
    agent_state_since: '2026-01-01T00:00:00Z',
    agent_state_signal: 'activity',
  };
  const once = applyServerMessage(prev, msg);
  const twice = applyServerMessage(once, msg);
  assert.deepEqual(twice[0].agent_state, 'working');
  assert.equal(twice[0].agent_state_signal, 'activity');
});

test('reconnect snapshot then later transition keeps the latest state', () => {
  const snapshot = applyServerMessage([], {
    t: 'sessions',
    list: [session({ agent: 'codex', agent_state: 'working', agent_state_since: '2026-01-01T00:00:00Z' })],
  });
  const next = applyServerMessage(snapshot, {
    t: 'agent_state',
    sid: 's1',
    agent: 'codex',
    agent_state: 'blocked',
    agent_state_since: '2026-01-01T00:00:01Z',
    agent_state_signal: 'screen',
  });
  assert.equal(next[0].agent_state, 'blocked');
});

test('unknown messages leave sessions unchanged', () => {
  const prev = [session({ agent_state: 'idle' })];
  const next = applyServerMessage(prev, { t: 'future_frame', sid: 's1', extra: true });
  assert.equal(next, prev);
});

test('shell state frames keep agent fields', () => {
  const prev = [session({ agent: 'claude', agent_state: 'blocked', state: 'running' })];
  const next = applyServerMessage(prev, {
    t: 'state',
    sid: 's1',
    cwd: '/tmp/project',
    cmd: 'claude',
    state: 'running',
    exit: null,
    integrated: true,
    run_ms: 1200,
  });
  assert.equal(next[0].cwd, '/tmp/project');
  assert.equal(next[0].state, 'running');
  assert.equal(next[0].agent_state, 'blocked');
  assert.equal(next[0].agent, 'claude');
});
