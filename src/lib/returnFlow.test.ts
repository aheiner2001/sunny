import { describe, expect, it } from 'vitest';
import type { Vehicle, Inspection } from '@/types';
import { localDateString } from './occupancy';
import {
  DEFAULT_RETURN_QUESTIONS,
  hasReturnForShift,
  normalizeReturnQuestions,
  resolveReturnVehicle,
  shiftDateStringForVehicle,
  vehiclesInUse,
} from './returnFlow';

const van = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'van-1',
  vehicleNumber: 'Van #1',
  name: 'Transit',
  licensePlate: 'ABC',
  qrCodeToken: 'van-1',
  status: 'in_use',
  currentUserId: 'sam',
  currentUserName: 'Sam',
  ...over,
});

describe('normalizeReturnQuestions', () => {
  it('falls back to defaults when missing or empty', () => {
    expect(normalizeReturnQuestions(undefined).length).toBeGreaterThan(0);
    expect(normalizeReturnQuestions([]).length).toBeGreaterThan(0);
    expect(normalizeReturnQuestions(DEFAULT_RETURN_QUESTIONS)).toEqual(DEFAULT_RETURN_QUESTIONS);
  });
});

describe('resolveReturnVehicle', () => {
  it('prefers the signed-in drivers checked-out van', () => {
    const fleet = [
      van({ id: 'van-1', currentUserId: 'alex' }),
      van({ id: 'van-2', currentUserId: 'sam', vehicleNumber: 'Van #2' }),
    ];
    expect(resolveReturnVehicle({ userId: 'sam', vehicles: fleet })?.id).toBe('van-2');
  });

  it('uses missed-return vehicle when catching up', () => {
    const fleet = [van({ id: 'van-9', currentUserId: null, status: 'active' })];
    expect(
      resolveReturnVehicle({ userId: 'sam', vehicles: fleet, missed: { vehicleId: 'van-9' } })?.id
    ).toBe('van-9');
  });

  it('returns null when signed-in user has no van and no miss', () => {
    expect(resolveReturnVehicle({ userId: 'sam', vehicles: [van({ currentUserId: 'alex' })] })).toBeNull();
  });
});

describe('hasReturnForShift', () => {
  it('is true when a return inspection exists for that user/van/day', () => {
    const inspections: Pick<Inspection, 'vehicleId' | 'userId' | 'kind' | 'dateString' | 'submittedAt'>[] = [
      {
        vehicleId: 'van-1',
        userId: 'sam',
        kind: 'return',
        dateString: '2026-09-14',
        submittedAt: '2026-09-14T23:00:00.000Z',
      },
    ];
    expect(
      hasReturnForShift({
        vehicleId: 'van-1',
        userId: 'sam',
        shiftDateString: '2026-09-14',
        inspections,
      })
    ).toBe(true);
  });

  it('ignores pretrip inspections', () => {
    expect(
      hasReturnForShift({
        vehicleId: 'van-1',
        userId: 'sam',
        shiftDateString: '2026-09-14',
        inspections: [
          {
            vehicleId: 'van-1',
            userId: 'sam',
            kind: 'pretrip',
            dateString: '2026-09-14',
            submittedAt: '2026-09-14T15:00:00.000Z',
          },
        ],
      })
    ).toBe(false);
  });
});

describe('shiftDateStringForVehicle', () => {
  it('uses local date of currentUserStartAt when present', () => {
    const iso = '2026-09-14T18:00:00.000-07:00';
    expect(shiftDateStringForVehicle(van({ currentUserStartAt: iso }))).toBe(
      localDateString(new Date(iso))
    );
  });
});

describe('vehiclesInUse', () => {
  it('lists vans with a current driver', () => {
    expect(
      vehiclesInUse([
        van({ id: 'a', currentUserId: 'sam' }),
        van({ id: 'b', currentUserId: null, status: 'active' }),
      ]).map((v) => v.id)
    ).toEqual(['a']);
  });
});
