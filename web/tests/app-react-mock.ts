const getHooks = () =>
  (globalThis as typeof globalThis & {
    __webtabinalAppTest: {
      hooks: {
        useState: (...args: unknown[]) => unknown;
        useRef: (...args: unknown[]) => unknown;
        useCallback: (...args: unknown[]) => unknown;
        useMemo: (...args: unknown[]) => unknown;
        useEffect: (...args: unknown[]) => unknown;
      };
    };
  }).__webtabinalAppTest.hooks;

export const useState = (...args: unknown[]) => getHooks().useState(...args);
export const useRef = (...args: unknown[]) => getHooks().useRef(...args);
export const useCallback = (...args: unknown[]) => getHooks().useCallback(...args);
export const useMemo = (...args: unknown[]) => getHooks().useMemo(...args);
export const useEffect = (...args: unknown[]) => getHooks().useEffect(...args);

export const Fragment = Symbol.for('react.fragment');

export function jsx(type: unknown, props: unknown, key?: unknown) {
  return { type, props, key: key ?? null };
}

export const jsxs = jsx;
export const jsxDEV = jsx;
