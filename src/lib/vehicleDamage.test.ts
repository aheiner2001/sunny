import { describe, expect, it } from 'vitest';
import {
  assertDamagePayload,
  latestStatusBySide,
} from './vehicleDamage';
import type { VehicleDamageEvent } from '@/types';

function event(
  partial: Partial<VehicleDamageEvent> & Pick<VehicleDamageEvent, 'id' | 'side' | 'createdAt'>
): VehicleDamageEvent {
  return {
    vehicleId: 'van-1',
    noNewDamage: false,
    photoDataUrls: ['data:image/jpeg;base64,aaa'],
    userId: 'u1',
    userName: 'Sam',
    ...partial,
  };
}

describe('vehicleDamage helpers', () => {
  it('latestStatusBySide returns newest event per side', () => {
    const events = [
      event({ id: '1', side: 'left', createdAt: '2026-01-01T10:00:00.000Z', note: 'old' }),
      event({ id: '2', side: 'left', createdAt: '2026-01-02T10:00:00.000Z', note: 'new' }),
      event({ id: '3', side: 'front', createdAt: '2026-01-03T10:00:00.000Z' }),
      event({
        id: '4',
        side: null,
        noNewDamage: true,
        createdAt: '2026-01-04T10:00:00.000Z',
        photoDataUrls: [],
      }),
      event({ id: '5', side: 'rear', vehicleId: 'van-2', createdAt: '2026-01-05T10:00:00.000Z' }),
    ];

    const latest = latestStatusBySide(events, 'van-1');
    expect(latest.left?.id).toBe('2');
    expect(latest.left?.note).toBe('new');
    expect(latest.front?.id).toBe('3');
    expect(latest.rear).toBeNull();
    expect(latest.right).toBeNull();
  });

  it('rejects damage without side when not noNewDamage', () => {
    expect(() =>
      assertDamagePayload({ noNewDamage: false, side: null, photoDataUrls: ['x'] })
    ).toThrow(/side/i);
  });

  it('rejects more than 8 photos', () => {
    expect(() =>
      assertDamagePayload({
        noNewDamage: false,
        side: 'front',
        photoDataUrls: Array.from({ length: 9 }, (_, i) => `p${i}`),
      })
    ).toThrow(/8/);
  });

  it('allows noNewDamage without side or photos', () => {
    expect(() =>
      assertDamagePayload({ noNewDamage: true, side: null, photoDataUrls: [] })
    ).not.toThrow();
  });
});
