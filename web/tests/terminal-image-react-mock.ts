export {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  Fragment,
} from './app-react-mock.ts';

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
    assignRef(resolved.ref, { nodeType: 1, className: resolved.className });
  }
  return { type, props: resolved, key: key ?? null };
}

export const jsxs = jsx;
export const jsxDEV = jsx;
