import type { Vehicle } from '@/types';

export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function checkoutTimestamp(now = new Date()): { iso: string; display: string } {
  return {
    iso: now.toISOString(),
    display: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function formatCheckoutStarted(
  vehicle: Pick<Vehicle, 'currentUserStartAt' | 'currentUserStartTime'>
): string {
  if (vehicle.currentUserStartAt) {
    const d = new Date(vehicle.currentUserStartAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  }
  return vehicle.currentUserStartTime || 'earlier';
}

export type OccupancyKind = 'free' | 'mine' | 'theirs' | 'pending';

export function occupancyKind(
  vehicle: Pick<Vehicle, 'currentUserId'>,
  userId: string | null | undefined
): OccupancyKind {
  if (!vehicle.currentUserId) return 'free';
  if (!userId) return 'pending';
  if (vehicle.currentUserId === userId) return 'mine';
  return 'theirs';
}

export function shouldAutoReturnVehicle(
  vehicle: Pick<Vehicle, 'currentUserId' | 'currentUserStartAt' | 'lastInspectionAt'>,
  now = new Date()
): boolean {
  if (!vehicle.currentUserId) return false;
  const today = localDateString(now);
  if (vehicle.currentUserStartAt) {
    const start = new Date(vehicle.currentUserStartAt);
    if (Number.isNaN(start.getTime())) return false;
    return localDateString(start) !== today;
  }
  if (vehicle.lastInspectionAt) {
    const last = new Date(vehicle.lastInspectionAt);
    if (Number.isNaN(last.getTime())) return false;
    return localDateString(last) !== today;
  }
  return false;
}

export function vehicleInspectedOnLocalDay(
  vehicle: Pick<Vehicle, 'id' | 'lastInspectionAt'>,
  inspections: Array<{ vehicleId: string; dateString?: string; submittedAt?: string }>,
  now = new Date()
): boolean {
  const today = localDateString(now);
  if (vehicle.lastInspectionAt) {
    const last = new Date(vehicle.lastInspectionAt);
    if (!Number.isNaN(last.getTime()) && localDateString(last) === today) return true;
  }
  return inspections.some((insp) => {
    if (insp.vehicleId !== vehicle.id) return false;
    if (insp.dateString === today) return true;
    if (!insp.submittedAt) return false;
    const submitted = new Date(insp.submittedAt);
    return !Number.isNaN(submitted.getTime()) && localDateString(submitted) === today;
  });
}

export function checkInFields<T extends Vehicle>(vehicle: T): T {
  return {
    ...vehicle,
    status: vehicle.status === 'maintenance' ? 'maintenance' : 'active',
    currentUserId: null,
    currentUserName: null,
    currentUserStartTime: null,
    currentUserStartAt: null,
  };
}

export function checkOutFields<T extends Vehicle>(
  vehicle: T,
  user: { id: string; name: string },
  now = new Date()
): T {
  const ts = checkoutTimestamp(now);
  return {
    ...vehicle,
    status: vehicle.status === 'maintenance' ? 'maintenance' : 'in_use',
    currentUserId: user.id,
    currentUserName: user.name,
    currentUserStartTime: ts.display,
    currentUserStartAt: ts.iso,
  };
}

/** Assign inspector only when the van is free. Never steal another driver. Keep mine as-is. */
export function occupancyAfterInspection<T extends Vehicle>(
  vehicle: T,
  inspector: { id?: string | null; name?: string | null },
  now = new Date()
): T {
  if (vehicle.currentUserId) return vehicle;
  const id = inspector.id || 'anon';
  const name = inspector.name || 'Inspector';
  return checkOutFields(vehicle, { id, name }, now);
}
