import type { Vehicle, VehicleAssignment } from '@/types';
import { checkInFields, checkOutFields } from './occupancy';

export type AssignmentRequest = {
  vehicleId: string;
  user: { id: string; name: string } | null;
  effectiveAt: string;
  recordedAt: string;
  source: VehicleAssignment['source'];
  actor: { id: string; name: string };
};

export function transitionAssignment(
  assignments: VehicleAssignment[], vehicles: Vehicle[], request: AssignmentRequest
): { assignments: VehicleAssignment[]; vehicles: Vehicle[] } {
  const time = new Date(request.effectiveAt);
  if (!Number.isFinite(time.getTime())) throw new Error('Enter a valid assignment time.');
  if (time.getTime() > new Date(request.recordedAt).getTime() + 60_000) throw new Error('Assignment time cannot be in the future.');
  const vehicle = vehicles.find(v => v.id === request.vehicleId);
  if (!vehicle) throw new Error('Vehicle not found.');
  if (request.user && vehicle.status === 'inactive') throw new Error('Inactive vehicles cannot be assigned.');
  const active = assignments.filter(a => !a.endedAt);
  const same = active.find(a => a.vehicleId === request.vehicleId && a.userId === request.user?.id);
  if (same && request.user) {
    if (request.source !== 'manager' || same.startedAt === time.toISOString()) return { assignments, vehicles };
    for (const item of assignments.filter(a => a.endedAt && a.id !== same.id)) {
      if ((item.vehicleId === vehicle.id || item.userId === request.user.id) && time.getTime() < new Date(item.endedAt!).getTime()) {
        throw new Error('That time overlaps a previous assignment.');
      }
    }
    const corrected = { ...same, startedAt: time.toISOString(), actorId: request.actor.id,
      actorName: request.actor.name, recordedAt: request.recordedAt,
      corrections: [...(same.corrections || []), { previousStartedAt: same.startedAt, correctedAt: request.recordedAt, actorId: request.actor.id, actorName: request.actor.name }] };
    return {
      assignments: assignments.map(a => a.id === same.id ? corrected : a),
      vehicles: vehicles.map(v => v.id === vehicle.id ? checkOutFields(v, request.user!, time) : v),
    };
  }
  const affected = active.filter(a => a.vehicleId === request.vehicleId || (request.user && a.userId === request.user.id));
  for (const item of affected) {
    if (time.getTime() < new Date(item.startedAt).getTime()) {
      throw new Error(`Assignment time cannot be before ${item.userName}'s current start time.`);
    }
  }
  for (const item of assignments.filter(a => a.endedAt)) {
    if (item.vehicleId === request.vehicleId || (request.user && item.userId === request.user.id)) {
      const end = new Date(item.endedAt!).getTime();
      if (request.user && time.getTime() < end) {
        throw new Error('That time overlaps a previous assignment.');
      }
    }
  }
  const closingIds = new Set(affected.map(a => a.id));
  const nextAssignments = assignments.map(a => closingIds.has(a.id) ? { ...a, endedAt: time.toISOString() } : a);
  if (request.user) {
    nextAssignments.push({
      id: crypto.randomUUID(), vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber,
      userId: request.user.id, userName: request.user.name, startedAt: time.toISOString(),
      endedAt: null, source: request.source, actorId: request.actor.id,
      actorName: request.actor.name, recordedAt: request.recordedAt,
    });
  }
  const affectedVehicleIds = new Set([vehicle.id, ...affected.map(a => a.vehicleId)]);
  const nextVehicles = vehicles.map(v => {
    if (!affectedVehicleIds.has(v.id)) return v;
    return request.user && v.id === vehicle.id ? checkOutFields(v, request.user, time) : checkInFields(v);
  });
  return { assignments: nextAssignments, vehicles: nextVehicles };
}
