// Attaching an image to a coding agent's prompt means handing it a path.
// Claude Code, Codex, and cursor-agent all read an image from disk, and a
// native terminal's only way to deliver a dropped file is to type its path in.
// So the browser uploads the bytes, the daemon writes a file, and the path
// goes into the PTY exactly as a drag-and-drop would produce it.

export const ATTACHABLE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

export type SavedImage = {
  path: string;
  name: string;
  mime: string;
  bytes: number;
};

export function isAttachableImageType(type: string | null | undefined): boolean {
  if (!type) return false;
  const base = type.split(';')[0].trim().toLowerCase();
  return (ATTACHABLE_IMAGE_TYPES as readonly string[]).includes(base);
}

type TypedFile = { type: string };

/** The attachable images in a FileList or DataTransferItemList-derived array. */
export function attachableImages<T extends TypedFile>(files: ArrayLike<T> | null | undefined): T[] {
  if (!files) return [];
  return Array.from(files).filter((file) => isAttachableImageType(file.type));
}

/** True when a drag carries files, so the terminal should claim the drop. */
export function dragCarriesFiles(types: ArrayLike<string> | null | undefined): boolean {
  if (!types) return false;
  return Array.from(types).includes('Files');
}

// Characters a shell — and the agent composers that mimic one when parsing a
// dropped path — would otherwise read as token separators. The daemon never
// generates a filename containing any of them, but the directory prefix does:
// `~/Library/Application Support/...` has a space, and so can a home directory.
const NEEDS_ESCAPE = /[ \t\n"'\\$`&|;<>()*?[\]{}!#]/g;

/** Backslash-escape a path the way a terminal does when a file is dropped. */
export function escapeTerminalPath(path: string): string {
  return path.replace(NEEDS_ESCAPE, (ch) => `\\${ch}`);
}

/**
 * The text to type into the PTY for a set of freshly stored images. Paths are
 * space-separated and end with a trailing space, so whatever the user types
 * next does not run into the last path.
 */
export function terminalTextForPaths(paths: string[]): string {
  const usable = paths.filter((path) => path.trim() !== '');
  if (usable.length === 0) return '';
  return `${usable.map(escapeTerminalPath).join(' ')} `;
}

/**
 * Reads an attachable image off the browser clipboard, or null when the
 * clipboard holds no image, the API is missing, or permission is refused.
 * A refusal is not an error here: the caller falls back to a text paste.
 */
export async function readClipboardImage(
  clipboard: Clipboard | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard,
): Promise<Blob | null> {
  if (!clipboard?.read) return null;
  try {
    const items = await clipboard.read();
    for (const item of items) {
      const type = item.types.find(isAttachableImageType);
      if (type) return await item.getType(type);
    }
  } catch {
    /* no clipboard-read permission, or nothing readable */
  }
  return null;
}

/** Rebuilds a Blob from the base64 the desktop shell reads off NSPasteboard. */
export function blobFromBase64(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
