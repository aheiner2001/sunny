import { describe, it, expect } from 'vitest';
import {
  calculateLifespanDueDate,
  computeLifespanStatus,
  extendLifespan,
  replaceLifespan,
  retireLifespan,
  formatIndividualToolName,
  isMultiQtyLifespanItem
} from '@/lib/lifespan';
import { Equipment } from '@/types';

describe('lifespan calculation helpers', () => {
  it('formats individual tool names for batches', () => {
    expect(formatIndividualToolName('Brushy', 1, 1)).toBe('Brushy');
    expect(formatIndividualToolName('Brushy', 2, 3)).toBe('Brushy #2');
  });

  it('detects multi-qty lifespan stock pools', () => {
    expect(
      isMultiQtyLifespanItem({
        lifespanEnabled: true,
        totalQuantity: 3,
        assignments: []
      })
    ).toBe(true);
    expect(
      isMultiQtyLifespanItem({
        lifespanEnabled: true,
        totalQuantity: 1,
        assignments: [{ vehicleId: 'v1', vehicleNumber: 'Van #1', quantity: 1 }]
      })
    ).toBe(false);
  });

  it('calculates due date correctly from start date and months', () => {
    const start = '2026-01-15T00:00:00.000Z';
    const due = calculateLifespanDueDate(start, 6);
    const dueDate = new Date(due);
    expect(dueDate.getUTCFullYear()).toBe(2026);
    expect(dueDate.getUTCMonth()).toBe(6); // July (0-indexed 6)
  });

  describe('usage mode status calculations', () => {
    const baseUsageTool: Equipment = {
      id: 'eq-brush-1',
      name: 'Detailing Brush Set',
      category: 'equipment',
      status: 'working',
      lifespanEnabled: true,
      lifespanMode: 'usage',
      expectedCars: 300,
      carsUsed: 0
    };

    it('returns ok when remaining > 20%', () => {
      // 300 expected, 200 used => 100 remaining (33.3% > 20%)
      const status = computeLifespanStatus({ ...baseUsageTool, carsUsed: 200 });
      expect(status).toBe('ok');
    });

    it('returns getting_low when remaining <= 20% and > 0', () => {
      // 300 expected, 240 used => 60 remaining (20%)
      expect(computeLifespanStatus({ ...baseUsageTool, carsUsed: 240 })).toBe('getting_low');
      // 300 expected, 299 used => 1 remaining
      expect(computeLifespanStatus({ ...baseUsageTool, carsUsed: 299 })).toBe('getting_low');
    });

    it('returns due_for_review when carsUsed >= expectedCars', () => {
      // 300 expected, 300 used
      expect(computeLifespanStatus({ ...baseUsageTool, carsUsed: 300 })).toBe('due_for_review');
      // 300 expected, 350 used
      expect(computeLifespanStatus({ ...baseUsageTool, carsUsed: 350 })).toBe('due_for_review');
    });

    it('returns null when lifespan is not enabled or tool is retired', () => {
      expect(computeLifespanStatus({ ...baseUsageTool, lifespanEnabled: false })).toBeNull();
      expect(computeLifespanStatus({ ...baseUsageTool, retiredAt: '2026-09-01T00:00:00.000Z' })).toBeNull();
    });
  });

  describe('time mode status calculations', () => {
    const baseTimeTool: Equipment = {
      id: 'eq-hose-1',
      name: 'Air Compressor Hose Reel',
      category: 'equipment',
      status: 'working',
      lifespanEnabled: true,
      lifespanMode: 'time',
      expectedMonths: 24,
      lifeStartedAt: '2024-09-01T00:00:00.000Z',
      dueDate: '2026-09-01T00:00:00.000Z'
    };

    it('returns ok when more than 30 days before due date', () => {
      const refDate = new Date('2026-07-01T00:00:00.000Z'); // ~60 days before Sept 1
      expect(computeLifespanStatus(baseTimeTool, refDate)).toBe('ok');
    });

    it('returns getting_low when within 30 days of due date', () => {
      const refDate = new Date('2026-08-15T00:00:00.000Z'); // 17 days before Sept 1
      expect(computeLifespanStatus(baseTimeTool, refDate)).toBe('getting_low');
    });

    it('returns due_for_review when today >= due date', () => {
      const onDueDay = new Date('2026-09-01T00:00:00.000Z');
      expect(computeLifespanStatus(baseTimeTool, onDueDay)).toBe('due_for_review');

      const pastDue = new Date('2026-09-10T00:00:00.000Z');
      expect(computeLifespanStatus(baseTimeTool, pastDue)).toBe('due_for_review');
    });
  });

  describe('manager actions', () => {
    it('extends usage-mode tool by N cars and updates status', () => {
      const tool: Equipment = {
        id: 'eq-1',
        name: 'Brush',
        category: 'equipment',
        status: 'working',
        lifespanEnabled: true,
        lifespanMode: 'usage',
        expectedCars: 100,
        carsUsed: 100,
        lifespanStatus: 'due_for_review'
      };

      const extended = extendLifespan(tool, 50);
      expect(extended.expectedCars).toBe(150);
      // 100 used out of 150 -> 50 remaining (33.3% > 20%) -> ok
      expect(extended.lifespanStatus).toBe('ok');
    });

    it('extends time-mode tool by N months and updates dueDate', () => {
      const tool: Equipment = {
        id: 'eq-2',
        name: 'Hose',
        category: 'equipment',
        status: 'working',
        lifespanEnabled: true,
        lifespanMode: 'time',
        expectedMonths: 12,
        lifeStartedAt: '2025-01-01T00:00:00.000Z',
        dueDate: '2026-01-01T00:00:00.000Z',
        lifespanStatus: 'due_for_review'
      };

      const extended = extendLifespan(tool, 6);
      expect(extended.expectedMonths).toBe(18);
      const newDue = new Date(extended.dueDate!);
      expect(newDue.getUTCMonth()).toBe(6); // July 2026
    });

    it('replaces usage-mode tool (resets carsUsed to 0)', () => {
      const tool: Equipment = {
        id: 'eq-1',
        name: 'Brush',
        category: 'equipment',
        status: 'working',
        lifespanEnabled: true,
        lifespanMode: 'usage',
        expectedCars: 100,
        carsUsed: 100,
        lifespanStatus: 'due_for_review'
      };

      const replaced = replaceLifespan(tool);
      expect(replaced.carsUsed).toBe(0);
      expect(replaced.lifespanStatus).toBe('ok');
    });

    it('replaces time-mode tool (starts new life clock from today)', () => {
      const tool: Equipment = {
        id: 'eq-2',
        name: 'Hose',
        category: 'equipment',
        status: 'working',
        lifespanEnabled: true,
        lifespanMode: 'time',
        expectedMonths: 24,
        lifeStartedAt: '2020-01-01T00:00:00.000Z',
        dueDate: '2022-01-01T00:00:00.000Z',
        lifespanStatus: 'due_for_review'
      };

      const replaced = replaceLifespan(tool);
      expect(new Date(replaced.lifeStartedAt!).getFullYear()).toBeGreaterThanOrEqual(2026);
      expect(replaced.lifespanStatus).toBe('ok');
    });

    it('retires equipment item and clears lifespanStatus', () => {
      const tool: Equipment = {
        id: 'eq-1',
        name: 'Brush',
        category: 'equipment',
        status: 'working',
        lifespanEnabled: true,
        lifespanMode: 'usage',
        expectedCars: 100,
        carsUsed: 100,
        lifespanStatus: 'due_for_review'
      };

      const retired = retireLifespan(tool);
      expect(retired.retiredAt).toBeDefined();
      expect(retired.lifespanStatus).toBeNull();
    });
  });
});
