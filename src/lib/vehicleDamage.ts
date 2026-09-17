import { asset } from '@/lib/basePath';
import type { VehicleDamageEvent, VehicleSide } from '@/types';

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
}): void {
  const { noNewDamage, side, photoDataUrls } = args;
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
}
