import { useEffect, useState } from 'react';
import type { ColorScheme } from './types';

export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Terminal palette per theme. Backgrounds mirror --bg in index.css.
export const terminalTheme: Record<ResolvedTheme, {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
}> = {
  dark: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    selectionBackground: '#264f78',
  },
  light: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#000000',
    selectionBackground: '#add6ff',
  },
};

// WCAG AA. TUI apps often paint a black cell with the default (dark) foreground
// on a light terminal; xterm.js then lifts the fg just enough to stay readable.
export const TERMINAL_MIN_CONTRAST_RATIO = 4.5;

export function xtermViewOptions(theme: ResolvedTheme) {
  return {
    theme: terminalTheme[theme],
    minimumContrastRatio: TERMINAL_MIN_CONTRAST_RATIO,
  };
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(scheme: ColorScheme | undefined, system: ResolvedTheme): ResolvedTheme {
  return scheme === 'light' || scheme === 'dark' ? scheme : system;
}

export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', terminalTheme[theme].background);
}

/** Resolves `color_scheme` to a concrete theme and applies it to the document. */
export function useColorScheme(scheme: ColorScheme | undefined): ResolvedTheme {
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    setSystem(mq.matches ? 'dark' : 'light');
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(scheme, system);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  return resolved;
}
