// courses/cse499/__tests__/smokeTestBaseline.test.ts
import { describe, it, expect } from 'vitest';
import fixtures from '../fixtures/smoke-test-entities.json';

describe('Week 9 Smoke Test Baseline (M1, M4)', () => {
  it('validates fictional test entities are correctly defined', () => {
    expect(fixtures.employees.length).toBe(2);
    expect(fixtures.managers.length).toBe(1);
    expect(fixtures.vehicles.length).toBe(2);
  });

  it('verifies M4 shift duration calculation: 09:00-11:00 with 15m break equals exactly 1.75 hours', () => {
    const start = new Date(fixtures.testShift.start).getTime();
    const end = new Date(fixtures.testShift.end).getTime();
    const grossHours = (end - start) / (1000 * 60 * 60);
    const breakHours = fixtures.testShift.unpaidBreakMinutes / 60;
    const netHours = grossHours - breakHours;

    expect(netHours).toBe(fixtures.testShift.expectedNetHours);
    expect(netHours).toBe(1.75);
  });
});
