import { describe, expect, it } from 'vitest';
import type { Vehicle } from '@/types';
import {
  occupancyAfterInspection,
  occupancyKind,
  shouldAutoReturnVehicle,
  vehicleInspectedOnLocalDay,
} from './occupancy';

const van = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'van-1',
  vehicleNumber: 'Van #1',
  name: 'Transit',
  licensePlate: 'ABC',
  qrCodeToken: 'van-1',
  status: 'in_use',
  currentUserId: 'alex',
  currentUserName: 'Alex',
  currentUserStartTime: '7:42 AM',
  ...over,
});

describe('shouldAutoReturnVehicle', () => {
  const now = new Date('2026-09-11T18:00:00');

  it('leaves unassigned vans alone', () => {
    expect(shouldAutoReturnVehicle(van({ currentUserId: null, currentUserStartAt: null }), now)).toBe(false);
  });

  it('returns a van checked out on a previous local day', () => {
    expect(shouldAutoReturnVehicle(van({ currentUserStartAt: '2026-09-10T15:00:00.000Z' }), now)).toBe(true);
  });

  it('keeps a van checked out today', () => {
    expect(shouldAutoReturnVehicle(van({ currentUserStartAt: now.toISOString() }), now)).toBe(false);
  });

  it('uses last inspection day when checkout has no ISO timestamp', () => {
    expect(shouldAutoReturnVehicle(van({ currentUserStartAt: null, lastInspectionAt: '2026-09-10T22:00:00.000Z' }), now)).toBe(true);
    expect(shouldAutoReturnVehicle(van({ currentUserStartAt: null, lastInspectionAt: now.toISOString() }), now)).toBe(false);
  });

  it('does not guess when there is no date at all', () => {
    expect(shouldAutoReturnVehicle(van({ currentUserStartAt: null, lastInspectionAt: null }), now)).toBe(false);
  });
});

describe('occupancyKind', () => {
  it('classifies free, mine, and theirs', () => {
    expect(occupancyKind(van({ currentUserId: null }), 'sam')).toBe('free');
    expect(occupancyKind(van({ currentUserId: 'sam' }), 'sam')).toBe('mine');
    expect(occupancyKind(van({ currentUserId: 'alex' }), 'sam')).toBe('theirs');
    expect(occupancyKind(van({ currentUserId: 'alex' }), null)).toBe('pending');
  });
});

describe('occupancyAfterInspection', () => {
  const now = new Date('2026-09-11T18:00:00');

  it('checks out a free van to the inspector', () => {
    const next = occupancyAfterInspection(van({ currentUserId: null, currentUserName: null, status: 'active' }), { id: 'sam', name: 'Sam' }, now);
    expect(next.currentUserId).toBe('sam');
    expect(next.status).toBe('in_use');
    expect(next.currentUserStartAt).toBe(now.toISOString());
  });

  it('does not steal another driver', () => {
    const current = van({ currentUserStartAt: '2026-09-11T12:00:00.000Z' });
    const next = occupancyAfterInspection(current, { id: 'sam', name: 'Sam' }, now);
    expect(next.currentUserId).toBe('alex');
    expect(next.currentUserStartAt).toBe(current.currentUserStartAt);
  });

  it('keeps the original start when the same driver inspects again', () => {
    const current = van({ currentUserId: 'sam', currentUserName: 'Sam', currentUserStartAt: '2026-09-11T12:00:00.000Z' });
    const next = occupancyAfterInspection(current, { id: 'sam', name: 'Sam' }, now);
    expect(next.currentUserStartAt).toBe(current.currentUserStartAt);
  });
});

describe('vehicleInspectedOnLocalDay', () => {
  const now = new Date('2026-09-11T18:00:00');

  it('is true when lastInspectionAt is today', () => {
    expect(vehicleInspectedOnLocalDay(van({ lastInspectionAt: now.toISOString() }), [], now)).toBe(true);
  });

  it('is true when an inspection record is from today', () => {
    expect(vehicleInspectedOnLocalDay(van({ lastInspectionAt: null }), [{ vehicleId: 'van-1', submittedAt: now.toISOString() }], now)).toBe(true);
  });
});
