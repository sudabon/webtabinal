export type ClipboardFocusKind = 'textfield' | 'terminal';

export type ClipboardShortcut = 'copy' | 'paste' | 'ignore';

export type ClipboardKeyLike = {
  type?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  key: string;
  isComposing?: boolean;
  keyCode?: number;
};

export type TerminalClipboardHost = {
  getSelection: () => string;
  paste: (text: string) => void;
};

export type TerminalClipboardFacade = {
  focusKind: () => ClipboardFocusKind;
  copyText: () => string;
  paste: (text: string) => void;
  insertIntoFocusedField: (text: string) => void;
};

export function isTextFieldElement(el: EventTarget | null | undefined): boolean {
  if (!el || typeof el !== 'object') return false;
  const node = el as { tagName?: string; className?: unknown; isContentEditable?: boolean };
  const tag = node.tagName?.toUpperCase();
  const className = typeof node.className === 'string' ? node.className : '';
  // xterm keeps focus on a hidden helper textarea; that is the terminal, not a form field.
  if (className.includes('xterm-helper-textarea')) return false;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  return Boolean(node.isContentEditable);
}

export function fieldSelectionText(el: EventTarget | null | undefined): string {
  if (!el || typeof el !== 'object') return '';
  const input = el as {
    tagName?: string;
    value?: string;
    selectionStart?: number | null;
    selectionEnd?: number | null;
  };
  const tag = input.tagName?.toUpperCase();
  if ((tag === 'INPUT' || tag === 'TEXTAREA') && typeof input.value === 'string') {
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    return input.value.slice(Math.min(start, end), Math.max(start, end));
  }
  return '';
}

export function insertTextIntoField(el: EventTarget | null | undefined, text: string): boolean {
  if (!text || !el || typeof el !== 'object') return false;
  const input = el as {
    tagName?: string;
    value?: string;
    selectionStart?: number | null;
    selectionEnd?: number | null;
    setSelectionRange?: (start: number, end: number) => void;
    dispatchEvent?: (event: Event) => boolean;
  };
  const tag = input.tagName?.toUpperCase();
  if ((tag !== 'INPUT' && tag !== 'TEXTAREA') || typeof input.value !== 'string') return false;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const next = input.value.slice(0, start) + text + input.value.slice(end);
  const proto = typeof HTMLInputElement !== 'undefined'
    ? (tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype)
    : undefined;
  const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(input, next);
  else input.value = next;
  const caret = start + text.length;
  input.setSelectionRange?.(caret, caret);
  if (typeof Event !== 'undefined' && input.dispatchEvent) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return true;
}

export function clipboardShortcutAction(
  event: ClipboardKeyLike,
  opts: { textFieldFocused?: boolean } = {},
): ClipboardShortcut {
  if (event.type && event.type !== 'keydown') return 'ignore';
  if (event.isComposing || event.keyCode === 229) return 'ignore';
  if (!event.metaKey || event.ctrlKey) return 'ignore';
  if (opts.textFieldFocused) return 'ignore';
  const key = event.key.toLowerCase();
  if (key === 'c') return 'copy';
  if (key === 'v') return 'paste';
  return 'ignore';
}

export function applyClipboardShortcut(
  action: ClipboardShortcut,
  ctx: {
    selection: string;
    writeText: (text: string) => void;
    requestPaste: () => void;
  },
): 'handled' | 'pass' {
  if (action === 'ignore') return 'pass';
  if (action === 'copy') {
    if (ctx.selection) ctx.writeText(ctx.selection);
    return 'handled';
  }
  ctx.requestPaste();
  return 'handled';
}

export function requestClipboardPaste(onDesktopRead: () => void, onWebRead: () => void): void {
  const w = typeof window !== 'undefined'
    ? window
    : (globalThis as { window?: { __WEBTABINAL_DESKTOP__?: boolean } }).window;
  if (w?.__WEBTABINAL_DESKTOP__) {
    onDesktopRead();
    return;
  }
  onWebRead();
}

declare global {
  interface Window {
    __WEBTABINAL_DESKTOP__?: boolean;
    __webtabinalClipboard?: TerminalClipboardFacade;
    webkit?: {
      messageHandlers?: {
        webtabinal?: { postMessage: (message: unknown) => void };
      };
    };
  }
}

export function postDesktopClipboardRead(): void {
  window.webkit?.messageHandlers?.webtabinal?.postMessage({ t: 'clipboardRead' });
}

export function installTerminalClipboardFacade(
  host: TerminalClipboardHost,
  target: { __webtabinalClipboard?: TerminalClipboardFacade; document?: Document } = window,
): () => void {
  const facade: TerminalClipboardFacade = {
    focusKind: () => {
      const active = target.document?.activeElement ?? (typeof document !== 'undefined' ? document.activeElement : null);
      return isTextFieldElement(active) ? 'textfield' : 'terminal';
    },
    copyText: () => {
      const active = target.document?.activeElement ?? (typeof document !== 'undefined' ? document.activeElement : null);
      if (isTextFieldElement(active)) return fieldSelectionText(active);
      return host.getSelection();
    },
    paste: (text: string) => {
      if (text) host.paste(text);
    },
    insertIntoFocusedField: (text: string) => {
      const active = target.document?.activeElement ?? (typeof document !== 'undefined' ? document.activeElement : null);
      insertTextIntoField(active, text);
    },
  };
  target.__webtabinalClipboard = facade;
  return () => {
    if (target.__webtabinalClipboard === facade) delete target.__webtabinalClipboard;
  };
}
