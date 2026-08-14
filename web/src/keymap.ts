export type KeyBindings = {
  enabled: boolean;
  prefix: string;
  next_tab: string;
  prev_tab: string;
};

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  enabled: false,
  prefix: 'ctrl+j',
  next_tab: 'n',
  prev_tab: 'p',
};

export const CHORD_TIMEOUT_MS = 3000;

export type BindingIssue =
  | 'prefix_no_modifier'
  | 'next_prev_equal'
  | 'escape'
  | 'unparsable'
  | 'reserved';

export type ChordAction = 'none' | 'arm' | 'next' | 'prev' | 'cancel';

export type ChordResolution = {
  pending: boolean;
  action: ChordAction;
};

export type KeyLike = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'Hyper', 'OS']);
const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'] as const;
const RESERVED_PREFIXES = new Set([
  'meta+1', 'meta+2', 'meta+3', 'meta+4', 'meta+5',
  'meta+6', 'meta+7', 'meta+8', 'meta+9',
  'meta+n', 'meta+c', 'meta+v',
]);

export function normalizeKeyEvent(event: KeyLike): string | null {
  if (event.isComposing || event.keyCode === 229) return null;
  if (MODIFIER_KEYS.has(event.key)) return null;

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');

  let base = event.key;
  if (base === ' ') base = 'space';
  else if (base === 'Esc') base = 'escape';
  else base = base.toLowerCase();
  parts.push(base);
  return parts.join('+');
}

export function formatBinding(spec: string): string {
  if (!spec) return '';
  return spec.split('+').map(formatPart).join('+');
}

function formatPart(part: string): string {
  switch (part) {
    case 'ctrl':
      return 'Ctrl';
    case 'alt':
      return 'Alt';
    case 'shift':
      return 'Shift';
    case 'meta':
      return 'Cmd';
    default:
      return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
  }
}

type ParsedBinding = { mods: string[]; key: string };

function parseBinding(spec: string): ParsedBinding | null {
  if (!spec || spec !== spec.toLowerCase()) return null;
  const parts = spec.split('+');
  if (parts.some((part) => part === '')) return null;
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1);
  let last = -1;
  const seen = new Set<string>();
  for (const mod of mods) {
    const idx = (MODIFIER_ORDER as readonly string[]).indexOf(mod);
    if (idx < 0 || seen.has(mod) || idx <= last) return null;
    seen.add(mod);
    last = idx;
  }
  if (!key || (MODIFIER_ORDER as readonly string[]).includes(key)) return null;
  return { mods, key };
}

export function validateBindings(bindings: KeyBindings): BindingIssue | null {
  const prefix = parseBinding(bindings.prefix);
  const next = parseBinding(bindings.next_tab);
  const prev = parseBinding(bindings.prev_tab);
  if (!prefix || !next || !prev) return 'unparsable';
  if (prefix.key === 'escape' || next.key === 'escape' || prev.key === 'escape') return 'escape';
  if (prefix.mods.length === 0) return 'prefix_no_modifier';
  if (bindings.next_tab === bindings.prev_tab) return 'next_prev_equal';
  if (RESERVED_PREFIXES.has(bindings.prefix)) return 'reserved';
  return null;
}

export function resolveChordKey(
  pending: boolean,
  spec: string | null,
  bindings: KeyBindings,
): ChordResolution {
  if (!bindings.enabled) return { pending: false, action: 'none' };
  if (!spec) return { pending, action: 'none' };
  if (spec === bindings.prefix) return { pending: true, action: 'arm' };
  if (!pending) return { pending: false, action: 'none' };
  if (spec === 'escape') return { pending: false, action: 'cancel' };
  if (spec === bindings.next_tab) return { pending: false, action: 'next' };
  if (spec === bindings.prev_tab) return { pending: false, action: 'prev' };
  return { pending: false, action: 'cancel' };
}

export function neighbourTabIndex(
  count: number,
  activeIndex: number,
  direction: 'next' | 'prev',
): number {
  if (count <= 0 || activeIndex < 0 || activeIndex >= count) return -1;
  if (count === 1) return activeIndex;
  if (direction === 'next') return (activeIndex + 1) % count;
  return (activeIndex - 1 + count) % count;
}
