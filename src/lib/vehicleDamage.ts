import { asset } from '@/lib/basePath';
import type { DamageRegion, VehicleDamageEvent, VehicleSide } from '@/types';

export const VEHICLE_SIDES: VehicleSide[] = ['front', 'rear', 'left', 'right', 'cab'];

export const SIDE_LABEL: Record<VehicleSide, string> = {
  front: 'Front',
  rear: 'Rear',
  left: 'Left',
  right: 'Right',
  cab: 'Cab',
};


export const SIDE_IMAGE: Record<VehicleSide, string> = {
  front: asset('/vehicle-damage/maverick/front.png'),
  rear: asset('/vehicle-damage/maverick/rear.png'),
  left: asset('/vehicle-damage/maverick/left.png'),
  right: asset('/vehicle-damage/maverick/right.png'),
  cab: asset('/vehicle-damage/maverick/cab.png'),
};

/** Top-down overview when no side is selected. */
export const OVERVIEW_IMAGE = asset('/vehicle-damage/maverick/top.png');

export const MAX_DAMAGE_PHOTOS = 8;

export const MIN_REGION_SIZE = 0.02;

export function normalizeRegion(raw: DamageRegion): DamageRegion {
  let x = Number.isFinite(raw.x) ? raw.x : 0;
  let y = Number.isFinite(raw.y) ? raw.y : 0;
  let w = Number.isFinite(raw.w) ? raw.w : 0;
  let h = Number.isFinite(raw.h) ? raw.h : 0;

  w = Math.min(1, Math.max(0, w));
  h = Math.min(1, Math.max(0, h));
  x = Math.min(Math.max(0, x), 1);
  y = Math.min(Math.max(0, y), 1);
  // Prefer preserving size: pull origin back when the box would overflow.
  if (x + w > 1) x = Math.max(0, 1 - w);
  if (y + h > 1) y = Math.max(0, 1 - h);
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return { x, y, w, h };
}

export function isValidRegion(region: DamageRegion | null | undefined): boolean {
  if (!region) return false;
  const r = normalizeRegion(region);
  return r.w >= MIN_REGION_SIZE && r.h >= MIN_REGION_SIZE;
}

export function eventsWithRegionForSide(
  events: VehicleDamageEvent[],
  side: VehicleSide
): VehicleDamageEvent[] {
  return events.filter((e) => e.side === side && isValidRegion(e.region));
}

export function latestStatusBySide(
  events: VehicleDamageEvent[],
  vehicleId: string
): Record<VehicleSide, VehicleDamageEvent | null> {
  const result: Record<VehicleSide, VehicleDamageEvent | null> = {
    front: null,
    rear: null,
    left: null,
    right: null,
    cab: null,
  };
  const forVehicle = events
    .filter((e) => e.vehicleId === vehicleId && e.side && !e.noNewDamage)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const event of forVehicle) {
    if (event.side) {
      result[event.side] = event;
    }
  }
  return result;
}

export function assertDamagePayload(args: {
  noNewDamage: boolean;
  side: VehicleSide | null;
  photoDataUrls: string[];
  region?: DamageRegion | null;
}): void {
  const { noNewDamage, side, photoDataUrls, region } = args;
  if (photoDataUrls.length > MAX_DAMAGE_PHOTOS) {
    throw new Error(`At most ${MAX_DAMAGE_PHOTOS} photos per damage entry`);
  }
  if (noNewDamage) {
    return;
  }
  if (!side) {
    throw new Error('Pick a vehicle side when reporting damage');
  }
  if (photoDataUrls.length < 1) {
    throw new Error('Add at least one photo when reporting damage');
  }
  if (!isValidRegion(region)) {
    throw new Error('Draw a box on the diagram to mark where the damage is');
  }
}
