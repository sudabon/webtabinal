import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

import type { AgentState } from '../src/types.ts';

type TreeNode = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

function childrenOf(node: TreeNode | undefined): unknown[] {
  const children = node?.props?.children;
  if (children == null) return [];
  return Array.isArray(children) ? children : [children];
}

function walk(node: unknown, visit: (n: TreeNode) => boolean | void): TreeNode | undefined {
  if (!node || typeof node !== 'object') return;
  const n = node as TreeNode;
  if (visit(n) === true) return n;
  for (const child of childrenOf(n)) {
    const found = walk(child, visit);
    if (found) return found;
  }
}

async function loadPill(t: { after: (fn: () => Promise<void> | void) => void }) {
  const reactMock = fileURLToPath(new URL('./app-react-mock.ts', import.meta.url));
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^react$/, replacement: reactMock },
        { find: /^react\/jsx-dev-runtime$/, replacement: reactMock },
        { find: /^react\/jsx-runtime$/, replacement: reactMock },
      ],
    },
    server: { middlewareMode: true },
  });
  t.after(async () => {
    await server.close();
  });
  return server.ssrLoadModule('/src/components/AgentStatePill.tsx') as Promise<{
    AgentStatePill: (props: { agent?: string; state?: AgentState | string }) => TreeNode | null;
    agentStateLabel: (agent: string | undefined, state: AgentState | string | undefined) => string;
  }>;
}

test('agent pill omits none and labels idle working blocked', async (t) => {
  const { AgentStatePill, agentStateLabel } = await loadPill(t);
  assert.equal(AgentStatePill({ state: 'none' }), null);
  assert.equal(AgentStatePill({ agent: 'codex' }), null);

  const working = AgentStatePill({ agent: 'codex', state: 'working' });
  assert.equal(working?.props?.['aria-label'], 'Codex working');
  assert.match(String(working?.props?.className), /agent-pill-working/);
  assert.ok(walk(working, (n) => n.props?.className === 'agent-pill-spinner'), 'working has an activity indicator');

  const blocked = AgentStatePill({ agent: 'claude', state: 'blocked' });
  assert.equal(blocked?.props?.['aria-label'], 'Claude Code blocked');
  assert.match(String(blocked?.props?.className), /agent-pill-blocked/);
  assert.equal(walk(blocked, (n) => n.props?.className === 'agent-pill-spinner'), undefined);

  const idle = AgentStatePill({ agent: 'codex', state: 'idle' });
  assert.equal(idle?.props?.['aria-label'], 'Codex idle');
  assert.match(String(idle?.props?.className), /agent-pill-idle/);

  assert.equal(agentStateLabel('claude', 'blocked'), 'Claude Code blocked');
});
