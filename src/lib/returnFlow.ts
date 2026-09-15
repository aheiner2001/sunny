import type { ChecklistQuestion, Inspection, MissedReturn, Vehicle } from '@/types';
import { localDateString } from './occupancy';

export const DEFAULT_RETURN_QUESTIONS: ChecklistQuestion[] = [
  {
    id: 'return-damage',
    text: 'Any new body damage or interior issues?',
    category: 'general',
    type: 'yes_no',
    required: true,
    order: 1,
  },
  {
    id: 'return-fuel',
    text: 'Fuel / supplies OK for the next driver?',
    category: 'general',
    type: 'yes_no',
    required: true,
    order: 2,
  },
  {
    id: 'return-notes',
    text: 'Anything else to report?',
    category: 'general',
    type: 'text',
    required: false,
    order: 3,
  },
];

export function normalizeReturnQuestions(
  questions?: ChecklistQuestion[] | null
): ChecklistQuestion[] {
  if (questions && questions.length > 0) return questions;
  return DEFAULT_RETURN_QUESTIONS;
}

export function vehiclesInUse(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter((v) => Boolean(v.currentUserId));
}

export function resolveReturnVehicle(args: {
  userId: string | null | undefined;
  vehicles: Vehicle[];
  missed?: Pick<MissedReturn, 'vehicleId'> | null;
}): Vehicle | null {
  const { userId, vehicles, missed } = args;
  if (missed?.vehicleId) {
    return vehicles.find((v) => v.id === missed.vehicleId) || null;
  }
  if (!userId) return null;
  const mine = vehicles.filter((v) => v.currentUserId === userId);
  if (mine.length >= 1) return mine[0];
  return null;
}

export function shiftDateStringForVehicle(
  vehicle: Pick<Vehicle, 'currentUserStartAt' | 'lastInspectionAt'>,
  now = new Date()
): string {
  if (vehicle.currentUserStartAt) {
    const d = new Date(vehicle.currentUserStartAt);
    if (!Number.isNaN(d.getTime())) return localDateString(d);
  }
  if (vehicle.lastInspectionAt) {
    const d = new Date(vehicle.lastInspectionAt);
    if (!Number.isNaN(d.getTime())) return localDateString(d);
  }
  return localDateString(now);
}

export function hasReturnForShift(args: {
  vehicleId: string;
  userId: string;
  shiftDateString: string;
  inspections: Pick<Inspection, 'vehicleId' | 'userId' | 'kind' | 'dateString' | 'submittedAt'>[];
}): boolean {
  const { vehicleId, userId, shiftDateString, inspections } = args;
  return inspections.some((insp) => {
    if (insp.vehicleId !== vehicleId || insp.userId !== userId) return false;
    if (insp.kind !== 'return') return false;
    if (insp.dateString === shiftDateString) return true;
    if (!insp.submittedAt) return false;
    const submitted = new Date(insp.submittedAt);
    if (Number.isNaN(submitted.getTime())) return false;
    return localDateString(submitted) === shiftDateString;
  });
}
