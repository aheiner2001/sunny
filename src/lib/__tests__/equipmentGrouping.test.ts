import { describe, it, expect } from 'vitest';
import {
  getEquipmentFamilyKey,
  getEquipmentFamilyLabel,
  groupEquipmentByFamily,
  summarizeEquipmentFamily
} from '@/lib/equipmentGrouping';
import { Equipment } from '@/types';

const base = (overrides: Partial<Equipment>): Equipment => ({
  id: 'eq-1',
  name: 'Brushy',
  category: 'equipment',
  status: 'working',
  ...overrides
});

describe('equipmentGrouping', () => {
  it('derives family key from toolFamily, else strips #N suffix from name', () => {
    expect(getEquipmentFamilyKey(base({ toolFamily: 'Finishing Pad', name: 'Finishing Pad #2' }))).toBe(
      'finishing pad'
    );
    expect(getEquipmentFamilyKey(base({ name: 'Brushy #3' }))).toBe('brushy');
    expect(getEquipmentFamilyKey(base({ name: 'Air Hose' }))).toBe('air hose');
  });

  it('uses human label from toolFamily or stripped name', () => {
    expect(getEquipmentFamilyLabel(base({ toolFamily: 'Finishing Pad', name: 'Finishing Pad #1' }))).toBe(
      'Finishing Pad'
    );
    expect(getEquipmentFamilyLabel(base({ name: 'Brushy #2' }))).toBe('Brushy');
  });

  it('groups instances under one family and keeps unrelated items separate', () => {
    const items = [
      base({ id: '1', name: 'Brushy #1', toolFamily: 'Brushy', lifespanEnabled: true, totalQuantity: 1 }),
      base({ id: '2', name: 'Brushy #2', toolFamily: 'Brushy', lifespanEnabled: true, totalQuantity: 1 }),
      base({
        id: '3',
        name: 'Towels',
        lifespanEnabled: false,
        totalQuantity: 12,
        availableQuantity: 12,
        assignments: []
      })
    ];

    const groups = groupEquipmentByFamily(items);
    expect(groups).toHaveLength(2);

    const brushy = groups.find(g => g.key === 'brushy');
    expect(brushy?.label).toBe('Brushy');
    expect(brushy?.items.map(i => i.id).sort()).toEqual(['1', '2']);

    const towels = groups.find(g => g.key === 'towels');
    expect(towels?.items).toHaveLength(1);
  });

  it('summarizes owned, shop, assigned, due, and low counts for a family', () => {
    const items = [
      base({
        id: '1',
        name: 'Brushy #1',
        toolFamily: 'Brushy',
        lifespanEnabled: true,
        totalQuantity: 1,
        availableQuantity: 0,
        assignments: [{ vehicleId: 'v1', vehicleNumber: 'Van #1', quantity: 1 }],
        carsUsed: 300,
        expectedCars: 300,
        lifespanStatus: 'due_for_review'
      }),
      base({
        id: '2',
        name: 'Brushy #2',
        toolFamily: 'Brushy',
        lifespanEnabled: true,
        totalQuantity: 1,
        availableQuantity: 1,
        assignments: [],
        carsUsed: 250,
        expectedCars: 300,
        lifespanStatus: 'getting_low'
      }),
      base({
        id: '3',
        name: 'Brushy #3',
        toolFamily: 'Brushy',
        lifespanEnabled: true,
        totalQuantity: 1,
        availableQuantity: 0,
        assignments: [{ vehicleId: 'v1', vehicleNumber: 'Van #1', quantity: 1 }],
        carsUsed: 10,
        expectedCars: 300,
        lifespanStatus: 'ok'
      })
    ];

    const summary = summarizeEquipmentFamily(items);
    expect(summary.unitCount).toBe(3);
    expect(summary.owned).toBe(3);
    expect(summary.inShop).toBe(1);
    expect(summary.assigned).toBe(2);
    expect(summary.dueForReview).toBe(1);
    expect(summary.gettingLow).toBe(1);
    expect(summary.lifespanTracked).toBe(true);
  });
});
