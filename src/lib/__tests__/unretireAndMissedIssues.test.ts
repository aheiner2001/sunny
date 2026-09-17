/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { retireLifespan, unretireLifespan } from '@/lib/lifespan';
import { calculatePassRate, findPossibleMissedIssues } from '@/lib/possibleMissedIssues';
import type { Equipment, Inspection, Issue } from '@/types';

const baseEquipment = (overrides: Partial<Equipment> = {}): Equipment => ({
  id: 'eq-1',
  name: 'Pressure Washer #1',
  toolFamily: 'Pressure Washer',
  category: 'equipment',
  status: 'working',
  lifespanEnabled: true,
  carsUsed: 10,
  expectedCars: 100,
  vehicleId: 'van-1',
  vehicleNumber: 'Van 1',
  ...overrides,
});

describe('unretireLifespan', () => {
  it('restores to shop as working, keeps retirement history, and audits unretired', () => {
    const retired = retireLifespan(baseEquipment(), {
      userId: 'mgr-1',
      userName: 'Manager',
      reason: 'End of life',
    });
    expect(retired.retiredAt).toBeTruthy();

    const restored = unretireLifespan(retired, {
      userId: 'mgr-1',
      userName: 'Manager',
      restoreStatus: 'working',
      reason: 'Still serviceable',
    });

    expect(restored.retiredAt).toBeNull();
    expect(restored.status).toBe('working');
    expect(restored.vehicleId).toBeNull();
    expect(restored.assignments).toEqual([]);
    const actions = (restored.lifespanHistory || []).map(h => h.action);
    expect(actions).toContain('retired');
    expect(actions).toContain('unretired');
  });

  it('can restore as flagged (needs-inspection) without dropping history', () => {
    const retired = retireLifespan(baseEquipment({ status: 'flagged' }));
    const restored = unretireLifespan(retired, { restoreStatus: 'flagged' });
    expect(restored.status).toBe('flagged');
    expect(restored.lifespanStatus).toBe('due_for_review');
    expect((restored.lifespanHistory || []).some(h => h.action === 'retired')).toBe(true);
  });
});

describe('possible missed issues (soft signal)', () => {
  const prior: Inspection = {
    id: 'insp-prior',
    vehicleId: 'van-1',
    vehicleNumber: 'Van 1',
    userId: 'u1',
    userName: 'Alex',
    userEmail: 'a@x.com',
    status: 'passed',
    startedAt: '2026-09-16T08:00:00.000Z',
    submittedAt: '2026-09-16T08:10:00.000Z',
    dateString: '2026-09-16',
    responses: [],
    issueIds: [],
  };

  const later: Inspection = {
    ...prior,
    id: 'insp-later',
    userId: 'u2',
    userName: 'Blake',
    status: 'issues_found',
    startedAt: '2026-09-17T08:00:00.000Z',
    submittedAt: '2026-09-17T08:10:00.000Z',
    dateString: '2026-09-17',
    issueIds: ['issue-1'],
  };

  const issue: Issue = {
    id: 'issue-1',
    vehicleId: 'van-1',
    vehicleNumber: 'Van 1',
    equipmentId: 'eq-1',
    equipmentName: 'Pressure Washer #1',
    reportedById: 'u2',
    reportedByName: 'Blake',
    reportedAt: '2026-09-17T08:10:00.000Z',
    dateString: '2026-09-17',
    inspectionId: 'insp-later',
    title: 'Washer leak',
    description: 'Hose leak',
    status: 'open',
    type: 'needs_repair',
  } as Issue;

  it('surfaces a soft prior-operator signal inside the window', () => {
    const signals = findPossibleMissedIssues([issue], [prior, later], { windowHours: 72 });
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('possible_missed_issue');
    expect(signals[0].priorUserName).toBe('Alex');
    expect(signals[0].priorInspectionId).toBe('insp-prior');
  });

  it('does not change pass-rate calculation (no auto-blame)', () => {
    const rate = calculatePassRate([prior, later]);
    // 1 passed / 2 inspections — later issues_found does not get blamed onto prior
    expect(rate).toBe(50);
    const signals = findPossibleMissedIssues([issue], [prior, later]);
    expect(signals[0].kind).toBe('possible_missed_issue');
    // soft signal list is separate from pass rate inputs
    expect(calculatePassRate([prior, later])).toBe(rate);
  });

  it('ignores priors outside the defensible window', () => {
    const oldPrior = {
      ...prior,
      id: 'insp-old',
      submittedAt: '2026-09-01T08:10:00.000Z',
      dateString: '2026-09-01',
    };
    expect(findPossibleMissedIssues([issue], [oldPrior, later], { windowHours: 72 })).toHaveLength(0);
  });
});
