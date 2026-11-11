// courses/cse499/__tests__/smokeTestBaseline.test.ts
import { describe, it, expect } from 'vitest';
import fixtures from '../fixtures/smoke-test-entities.json';
import { calculateNetSeconds } from '@/lib/timesheets/timeCalculations';

describe('Week 9 Smoke Test Baseline (M1, M4)', () => {
  it('validates fictional test entities are correctly defined', () => {
    expect(fixtures.employees.length).toBe(2);
    expect(fixtures.managers.length).toBe(1);
    expect(fixtures.vehicles.length).toBe(2);
  });

  it('verifies M4 shift duration calculation: 09:00-11:00 with 15m break equals exactly 1.75 hours', () => {
    const netSeconds = calculateNetSeconds(
      fixtures.testShift.start,
      fixtures.testShift.end,
      fixtures.testShift.unpaidBreakMinutes * 60
    );

    expect(netSeconds / 3600).toBe(fixtures.testShift.expectedNetHours);
    expect(netSeconds / 3600).toBe(1.75);
  });
});
