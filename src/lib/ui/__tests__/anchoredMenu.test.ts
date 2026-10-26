import { describe, expect, it } from 'vitest';
import {
  computeAnchoredMenuPlacement,
  isMenuFullyInViewport,
} from '../anchoredMenu';

const viewport = { width: 1000, height: 800 };

describe('computeAnchoredMenuPlacement — no-clip contract for every dropdown', () => {
  it('opens below the anchor when there is enough room', () => {
    const placement = computeAnchoredMenuPlacement({
      anchor: { top: 100, bottom: 140, left: 200, right: 280, width: 80, height: 40 },
      menu: { width: 320, height: 200 },
      viewport,
    });
    expect(placement.openUp).toBe(false);
    expect(placement.top).toBe(144); // bottom + gap
    expect(isMenuFullyInViewport(placement, { width: 320, height: 200 }, viewport)).toBe(true);
  });

  it('flips upward when the menu would be cut off at the viewport bottom', () => {
    const placement = computeAnchoredMenuPlacement({
      anchor: { top: 700, bottom: 740, left: 200, right: 280, width: 80, height: 40 },
      menu: { width: 320, height: 220 },
      viewport,
    });
    expect(placement.openUp).toBe(true);
    expect(placement.top + 220).toBeLessThanOrEqual(viewport.height - 8);
    expect(isMenuFullyInViewport(placement, { width: 320, height: 220 }, viewport)).toBe(true);
  });

  it('never places the menu below the viewport bottom (tall menu near bottom)', () => {
    const placement = computeAnchoredMenuPlacement({
      anchor: { top: 720, bottom: 760, left: 100, right: 180, width: 80, height: 40 },
      menu: { width: 280, height: 900 },
      viewport,
    });
    const visibleH = Math.min(900, placement.maxHeight);
    expect(placement.top + visibleH).toBeLessThanOrEqual(viewport.height - 8 + 0.5);
    expect(placement.maxHeight).toBe(viewport.height - 16);
    expect(placement.overflowY).toBe('auto');
    expect(isMenuFullyInViewport(placement, { width: 280, height: 900 }, viewport)).toBe(true);
  });

  it('never places the menu above the viewport top when flipping up', () => {
    const tiny = { width: 1000, height: 200 };
    const placement = computeAnchoredMenuPlacement({
      anchor: { top: 60, bottom: 100, left: 100, right: 180, width: 80, height: 40 },
      menu: { width: 280, height: 500 },
      viewport: tiny,
    });
    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(isMenuFullyInViewport(placement, { width: 280, height: 500 }, tiny)).toBe(true);
  });

  it('clamps horizontally so the menu is not cut off on the right', () => {
    const placement = computeAnchoredMenuPlacement({
      anchor: { top: 100, bottom: 140, left: 900, right: 980, width: 80, height: 40 },
      menu: { width: 320, height: 120 },
      viewport,
      align: 'end',
    });
    expect(placement.left + 320).toBeLessThanOrEqual(viewport.width - 8 + 0.5);
    expect(placement.left).toBeGreaterThanOrEqual(8);
  });

  it('clamps horizontally so the menu is not cut off on the left', () => {
    const placement = computeAnchoredMenuPlacement({
      anchor: { top: 100, bottom: 140, left: 10, right: 90, width: 80, height: 40 },
      menu: { width: 320, height: 120 },
      viewport,
      align: 'end',
    });
    expect(placement.left).toBeGreaterThanOrEqual(8);
  });

  it('keeps align=start menus fully inside the viewport', () => {
    const placement = computeAnchoredMenuPlacement({
      anchor: { top: 100, bottom: 140, left: 900, right: 980, width: 80, height: 40 },
      menu: { width: 320, height: 120 },
      viewport,
      align: 'start',
    });
    expect(placement.left + 320).toBeLessThanOrEqual(viewport.width - 8 + 0.5);
    expect(isMenuFullyInViewport(placement, { width: 320, height: 120 }, viewport)).toBe(true);
  });

  it('property: for many anchor positions near edges, placed menus stay in viewport', () => {
    const menu = { width: 300, height: 240 };
    const anchors = [
      { top: 10, bottom: 50, left: 10, right: 90, width: 80, height: 40 },
      { top: 10, bottom: 50, left: 900, right: 980, width: 80, height: 40 },
      { top: 740, bottom: 780, left: 10, right: 90, width: 80, height: 40 },
      { top: 740, bottom: 780, left: 900, right: 980, width: 80, height: 40 },
      { top: 400, bottom: 440, left: 460, right: 540, width: 80, height: 40 },
    ];
    for (const anchor of anchors) {
      const placement = computeAnchoredMenuPlacement({ anchor, menu, viewport });
      expect(
        isMenuFullyInViewport(placement, menu, viewport),
        `failed for anchor top=${anchor.top} left=${anchor.left}`,
      ).toBe(true);
    }
  });
});
