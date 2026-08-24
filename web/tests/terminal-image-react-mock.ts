export {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  Fragment,
} from './app-react-mock.ts';

/**
 * A DOM stand-in with enough surface for TerminalView's drop target: the
 * component adds listeners to the ref node and toggles a class on it.
 */
export type FakeNode = {
  nodeType: number;
  className: unknown;
  classes: Set<string>;
  classList: {
    toggle: (name: string, force?: boolean) => void;
    add: (name: string) => void;
    remove: (name: string) => void;
    contains: (name: string) => boolean;
  };
  contains: (other: unknown) => boolean;
  addEventListener: (type: string, fn: (event: unknown) => void) => void;
  removeEventListener: (type: string, fn: (event: unknown) => void) => void;
  dispatch: (type: string, event: unknown) => void;
  listenerCount: (type: string) => number;
};

function fakeNode(className: unknown): FakeNode {
  const classes = new Set<string>();
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  return {
    nodeType: 1,
    className,
    classes,
    classList: {
      toggle: (name, force) => {
        const on = force ?? !classes.has(name);
        if (on) classes.add(name);
        else classes.delete(name);
      },
      add: (name) => { classes.add(name); },
      remove: (name) => { classes.delete(name); },
      contains: (name) => classes.has(name),
    },
    contains: () => false,
    addEventListener: (type, fn) => {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener: (type, fn) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== fn));
    },
    dispatch: (type, event) => {
      for (const fn of [...(listeners.get(type) ?? [])]) fn(event);
    },
    listenerCount: (type) => (listeners.get(type) ?? []).length,
  };
}

function assignRef(ref: unknown, value: unknown) {
  if (!ref) return;
  if (typeof ref === 'function') {
    (ref as (node: unknown) => void)(value);
    return;
  }
  if (typeof ref === 'object') {
    (ref as { current: unknown }).current = value;
  }
}

export function jsx(type: unknown, props: Record<string, unknown> | null, key?: unknown) {
  const resolved = props ?? {};
  if (resolved.ref) {
    const node = fakeNode(resolved.className);
    // The test file loads this module through Node while TerminalView loads it
    // through Vite, so the two copies can only meet on globalThis.
    const g = globalThis as typeof globalThis & { __terminalRefNodes?: FakeNode[] };
    (g.__terminalRefNodes ??= []).push(node);
    assignRef(resolved.ref, node);
  }
  return { type, props: resolved, key: key ?? null };
}

export const jsxs = jsx;
export const jsxDEV = jsx;
