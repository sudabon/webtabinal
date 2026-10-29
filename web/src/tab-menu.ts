const VIEWPORT_MARGIN = 4;

/**
 * Places a menu with its top-left corner at the pointer, flipping to the left
 * of / above the pointer when it would overflow, and finally pinning it inside
 * the viewport when even the flipped side does not fit.
 */
export function placeMenu(opts: {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}): { left: number; top: number } {
  const place = (anchor: number, size: number, viewport: number) => {
    if (anchor + size <= viewport - VIEWPORT_MARGIN) return anchor;
    if (anchor - size >= VIEWPORT_MARGIN) return anchor - size;
    return Math.max(VIEWPORT_MARGIN, viewport - size - VIEWPORT_MARGIN);
  };
  return {
    left: place(opts.x, opts.width, opts.viewportWidth),
    top: place(opts.y, opts.height, opts.viewportHeight),
  };
}

/**
 * Index of the next enabled item in `direction`, wrapping around. Returns
 * `current` when nothing else is enabled and -1 when no item is.
 */
export function nextEnabledIndex(disabled: boolean[], current: number, direction: 1 | -1): number {
  const n = disabled.length;
  for (let step = 1; step <= n; step++) {
    const i = (((current + direction * step) % n) + n) % n;
    if (!disabled[i]) return i;
  }
  return -1;
}
