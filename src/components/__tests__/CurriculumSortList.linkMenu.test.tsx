import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  applyAnchoredMenuPlacement,
  isMenuFullyInViewport,
} from '@/lib/ui/anchoredMenu';
import type { TrainingItem } from '@/lib/training/types';
import type { ChecklistQuestion } from '@/types';

vi.mock('react-grid-layout', () => ({
  useContainerWidth: () => ({
    width: 640,
    mounted: true,
    containerRef: { current: null },
  }),
  GridLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="grid">{children}</div>,
}));

import { CurriculumSortList } from '../CurriculumSortList';

const item = (overrides: Partial<TrainingItem> = {}): TrainingItem => ({
  id: 'item-1',
  title: 'Cab wipe-down',
  order: 1,
  active: true,
  deadlineType: 'within_days',
  withinDays: 7,
  retrainThreshold: 2,
  linkedQuestionIds: [],
  createdAt: '2026-10-26T12:00:00Z',
  updatedAt: '2026-10-26T12:00:00Z',
  ...overrides,
});

const question = (overrides: Partial<ChecklistQuestion> = {}): ChecklistQuestion =>
  ({
    id: 'q-caddy',
    text: 'Chemical caddy filled?',
    type: 'yes_no',
    holdPreviousUserAccountable: true,
    order: 1,
    category: 'supplies',
    required: true,
    enabled: true,
    ...overrides,
  }) as ChecklistQuestion;

describe('CurriculumSortList Link menu — no viewport clipping', () => {
  it('portals the Link menu to document.body as a fixed anchored menu (not clipped by the card)', async () => {
    render(
      <CurriculumSortList
        items={[item()]}
        questions={[question()]}
        onReorder={vi.fn()}
        onDelete={vi.fn()}
        onSettingsBlur={vi.fn()}
        onToggleLinkedQuestion={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /link inspection questions/i }));

    const menu = await screen.findByRole('dialog', { name: /link questions for cab wipe-down/i });
    expect(menu.getAttribute('data-anchored-menu')).toBe('true');
    expect(menu.className).toMatch(/\bfixed\b/);
    expect(document.body.contains(menu)).toBe(true);
    // Must not live inside the grid card — absolute children there get cut off.
    expect(menu.closest('[aria-label="Curriculum steps"]')).toBeNull();
  });

  it('keeps a near-bottom Link menu fully inside the viewport after placement', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    render(
      <CurriculumSortList
        items={[item()]}
        questions={[question()]}
        onReorder={vi.fn()}
        onDelete={vi.fn()}
        onSettingsBlur={vi.fn()}
        onToggleLinkedQuestion={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /link inspection questions/i });
    const anchor = {
      top: 720,
      bottom: 760,
      left: 100,
      right: 180,
      width: 80,
      height: 40,
      x: 100,
      y: 720,
      toJSON: () => ({}),
    } as DOMRect;
    trigger.getBoundingClientRect = () => anchor;

    fireEvent.click(trigger);

    const menu = await screen.findByRole('dialog', { name: /link questions/i });
    Object.defineProperty(menu, 'offsetHeight', { configurable: true, value: 220 });
    Object.defineProperty(menu, 'offsetWidth', { configurable: true, value: 320 });

    const placement = applyAnchoredMenuPlacement(menu as HTMLElement, anchor, {
      width: 1000,
      height: 800,
    });

    await waitFor(() => {
      expect(menu.style.top).toBe(`${placement.top}px`);
    });

    expect(
      isMenuFullyInViewport(placement, { width: 320, height: 220 }, { width: 1000, height: 800 }),
    ).toBe(true);
    expect(placement.openUp).toBe(true);
  });
});
