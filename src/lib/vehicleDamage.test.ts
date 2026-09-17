import { describe, expect, it } from 'vitest';
import {
  assertDamagePayload,
  eventsWithRegionForSide,
  isValidRegion,
  latestStatusBySide,
  MIN_REGION_SIZE,
  normalizeRegion,
} from './vehicleDamage';
import type { DamageRegion, VehicleDamageEvent } from '@/types';

const validRegion: DamageRegion = { x: 0.1, y: 0.2, w: 0.3, h: 0.25 };

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
      event({ id: '6', side: 'cab', createdAt: '2026-01-06T10:00:00.000Z', note: 'dash scratch' }),
    ];

    const latest = latestStatusBySide(events, 'van-1');
    expect(latest.left?.id).toBe('2');
    expect(latest.left?.note).toBe('new');
    expect(latest.front?.id).toBe('3');
    expect(latest.cab?.id).toBe('6');
    expect(latest.rear).toBeNull();
    expect(latest.right).toBeNull();
  });

  it('rejects damage without side when not noNewDamage', () => {
    expect(() =>
      assertDamagePayload({
        noNewDamage: false,
        side: null,
        photoDataUrls: ['x'],
        region: validRegion,
      })
    ).toThrow(/side/i);
  });

  it('rejects more than 8 photos', () => {
    expect(() =>
      assertDamagePayload({
        noNewDamage: false,
        side: 'front',
        photoDataUrls: Array.from({ length: 9 }, (_, i) => `p${i}`),
        region: validRegion,
      })
    ).toThrow(/8/);
  });

  it('allows noNewDamage without side or photos', () => {
    expect(() =>
      assertDamagePayload({ noNewDamage: true, side: null, photoDataUrls: [] })
    ).not.toThrow();
  });
});

describe('damage regions', () => {
  it('normalizeRegion clamps into 0–1 and preserves positive size', () => {
    expect(normalizeRegion({ x: -0.1, y: 0.9, w: 0.5, h: 0.5 })).toEqual({
      x: 0,
      y: 0.5,
      w: 0.5,
      h: 0.5,
    });
  });

  it('isValidRegion rejects missing, zero, or undersized regions', () => {
    expect(isValidRegion(undefined)).toBe(false);
    expect(isValidRegion({ x: 0, y: 0, w: 0, h: 0.5 })).toBe(false);
    expect(isValidRegion({ x: 0, y: 0, w: MIN_REGION_SIZE / 2, h: MIN_REGION_SIZE })).toBe(false);
    expect(isValidRegion(validRegion)).toBe(true);
  });

  it('requires region when reporting damage', () => {
    expect(() =>
      assertDamagePayload({
        noNewDamage: false,
        side: 'front',
        photoDataUrls: ['x'],
        region: null,
      })
    ).toThrow(/region|box|mark/i);
  });

  it('allows noNewDamage without region', () => {
    expect(() =>
      assertDamagePayload({
        noNewDamage: true,
        side: null,
        photoDataUrls: [],
        region: null,
      })
    ).not.toThrow();
  });

  it('eventsWithRegionForSide returns only matching side events that have a region', () => {
    const events = [
      event({
        id: '1',
        side: 'front',
        createdAt: '2026-01-01T00:00:00.000Z',
        region: validRegion,
      }),
      event({
        id: '2',
        side: 'front',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
      event({
        id: '3',
        side: 'left',
        createdAt: '2026-01-03T00:00:00.000Z',
        region: validRegion,
      }),
    ];
    expect(eventsWithRegionForSide(events, 'front').map((e) => e.id)).toEqual(['1']);
  });
});
