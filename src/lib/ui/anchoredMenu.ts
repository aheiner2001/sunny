/** Viewport-relative box for an anchor (e.g. getBoundingClientRect). */
export type RectLike = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

export type AnchoredMenuPlacement = {
  top: number;
  left: number;
  maxHeight: number;
  openUp: boolean;
  overflowY: 'auto' | 'visible';
};

/**
 * Places a fixed menu relative to an anchor so it is never clipped by the
 * viewport bottom/sides. Flips upward when there is not enough room below.
 * Used by every anchored dropdown (equipment, employees, training Link, …).
 */
export function computeAnchoredMenuPlacement(input: {
  anchor: RectLike;
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  gap?: number;
  margin?: number;
  /** `end` = right edges align (default); `start` = left edges align */
  align?: 'end' | 'start';
}): AnchoredMenuPlacement {
  const gap = input.gap ?? 4;
  const margin = input.margin ?? 8;
  const maxHeight = Math.max(0, input.viewport.height - margin * 2);
  const height = Math.min(Math.max(0, input.menu.height), maxHeight);
  const overflowY: 'auto' | 'visible' = input.menu.height > maxHeight ? 'auto' : 'visible';

  const spaceBelow = input.viewport.height - input.anchor.bottom - margin;
  const spaceAbove = input.anchor.top - margin;
  const openUp = spaceBelow < height && spaceAbove > spaceBelow;

  let top = openUp
    ? input.anchor.top - gap - height
    : input.anchor.bottom + gap;
  // Keep the full visible menu inside the viewport (scroll inside if taller).
  top = Math.min(top, input.viewport.height - margin - height);
  top = Math.max(margin, top);

  const mw = Math.max(0, input.menu.width);
  let left =
    input.align === 'start' ? input.anchor.left : input.anchor.right - mw;
  left = Math.min(Math.max(margin, left), Math.max(margin, input.viewport.width - mw - margin));

  return { top, left, maxHeight, openUp, overflowY };
}

/** Apply placement styles to a fixed-position menu element. */
export function applyAnchoredMenuPlacement(
  menu: HTMLElement,
  anchor: RectLike,
  viewport: { width: number; height: number } = {
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  },
  options?: { gap?: number; margin?: number; align?: 'end' | 'start' },
): AnchoredMenuPlacement {
  const placement = computeAnchoredMenuPlacement({
    anchor,
    menu: { width: menu.offsetWidth, height: menu.offsetHeight },
    viewport,
    ...options,
  });
  menu.style.top = `${placement.top}px`;
  menu.style.left = `${placement.left}px`;
  menu.style.maxHeight = `${placement.maxHeight}px`;
  menu.style.overflowY = placement.overflowY;
  return placement;
}

/** True when a placed menu fits fully inside the viewport (with margin). */
export function isMenuFullyInViewport(
  placement: Pick<AnchoredMenuPlacement, 'top' | 'left' | 'maxHeight'>,
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): boolean {
  const height = Math.min(menu.height, placement.maxHeight);
  const bottom = placement.top + height;
  const right = placement.left + menu.width;
  return (
    placement.top >= margin - 0.5 &&
    placement.left >= margin - 0.5 &&
    bottom <= viewport.height - margin + 0.5 &&
    right <= viewport.width - margin + 0.5
  );
}

/**
 * Scroll/wheel inside the menu must not dismiss it — only outside page scroll
 * should reposition or close. Used by capture-phase scroll listeners.
 */
export function isEventInsideAnchoredMenu(
  menu: HTMLElement | null | undefined,
  target: EventTarget | null | undefined,
): boolean {
  if (!menu || !(target instanceof Node)) return false;
  return menu === target || menu.contains(target);
}
