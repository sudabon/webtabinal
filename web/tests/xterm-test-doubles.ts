type ImageHarness = {
  throwOnConstruct: boolean;
  constructed: unknown[];
  loaded: string[];
  terminals: FakeTerminal[];
  inputs: Array<{ sid: string; data: string }>;
  pastes: string[];
  wsListeners: Array<(event: { detail: unknown }) => void>;
  useWebgl: boolean;
};

function harness(): ImageHarness {
  return (globalThis as typeof globalThis & { __imageAddonTest: ImageHarness }).__imageAddonTest;
}

export class FakeTerminal {
  cols = 80;
  rows = 24;
  options: Record<string, unknown>;
  onDataHandler: ((data: string) => void) | null = null;

  constructor(options: Record<string, unknown>) {
    this.options = options;
    harness().terminals.push(this);
  }

  loadAddon(addon: { kind?: string }) {
    harness().loaded.push(addon.kind ?? 'unknown');
  }

  open() {
    harness().loaded.push('open');
  }

  onData(handler: (data: string) => void) {
    this.onDataHandler = handler;
    return { dispose() {} };
  }

  onSelectionChange() {
    return { dispose() {} };
  }

  attachCustomKeyEventHandler() {}
  focus() {}
  dispose() {}
  reset() {}
  getSelection() {
    return '';
  }
  paste(text: string) {
    harness().pastes.push(text);
  }

  write(_data: unknown, cb?: () => void) {
    cb?.();
  }
}

export class Terminal {
  constructor(options: Record<string, unknown>) {
    return new FakeTerminal(options);
  }
}

export class FitAddon {
  kind = 'fit';
  fit() {}
}

export class SearchAddon {
  kind = 'search';
}

export class WebLinksAddon {
  kind = 'links';
  constructor(_handler?: unknown) {}
}

export class WebglAddon {
  kind = 'webgl';
}

export class ImageAddon {
  kind = 'image';
  constructor(options: unknown) {
    const h = harness();
    h.constructed.push(options);
    if (h.throwOnConstruct) throw new Error('wasm refused');
  }
}

export default {};
