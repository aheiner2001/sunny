import { describe, expect, it } from 'vitest';
import { transitionAssignment } from '../vehicleAssignments';
import type { Vehicle, VehicleAssignment } from '@/types';

const van = (id: string, userId?: string): Vehicle => ({
  id, vehicleNumber: id, name: id, licensePlate: id, qrCodeToken: id,
  status: userId ? 'in_use' : 'active', currentUserId: userId || null,
  currentUserName: userId || null,
  currentUserStartAt: userId ? '2026-09-23T08:00:00.000Z' : null,
});
const record = (vehicleId: string, userId: string, startedAt = '2026-09-23T08:00:00.000Z'): VehicleAssignment => ({
  id: `${vehicleId}-${userId}`, vehicleId, vehicleNumber: vehicleId, userId, userName: userId,
  startedAt, endedAt: null, source: 'employee', actorId: userId, actorName: userId,
  recordedAt: startedAt,
});
const request = (vehicleId: string, userId: string | null, at = '2026-09-23T09:00:00.000Z') => ({
  vehicleId, user: userId ? { id: userId, name: userId } : null, effectiveAt: at,
  recordedAt: '2026-09-23T10:00:00.000Z', source: 'manager' as const,
  actor: { id: 'boss', name: 'Manager' },
});

describe('vehicle assignment transitions', () => {
  it('assigns a free van with distinct effective and record times', () => {
    const result = transitionAssignment([], [van('A')], request('A', 'alex'));
    expect(result.vehicles[0].currentUserId).toBe('alex');
    expect(result.assignments[0]).toMatchObject({ startedAt: '2026-09-23T09:00:00.000Z', recordedAt: '2026-09-23T10:00:00.000Z', actorId: 'boss' });
  });

  it('closes the old driver and previous van when an employee switches vans', () => {
    const result = transitionAssignment([record('A', 'alex'), record('B', 'beth')], [van('A', 'alex'), van('B', 'beth')], request('B', 'alex'));
    expect(result.assignments.filter(item => !item.endedAt)).toHaveLength(1);
    expect(result.assignments.filter(item => item.endedAt)).toHaveLength(2);
    expect(result.vehicles.find(item => item.id === 'A')?.currentUserId).toBeNull();
    expect(result.vehicles.find(item => item.id === 'B')?.currentUserId).toBe('alex');
  });

  it('releases an occupied van and rejects a backdate before its start', () => {
    expect(() => transitionAssignment([record('A', 'alex')], [van('A', 'alex')], request('A', null, '2026-09-23T07:00:00.000Z'))).toThrow();
    const result = transitionAssignment([record('A', 'alex')], [van('A', 'alex')], request('A', null));
    expect(result.assignments[0].endedAt).toBe('2026-09-23T09:00:00.000Z');
    expect(result.vehicles[0].currentUserId).toBeNull();
  });

  it('avoids duplicate active assignments and invalid dates', () => {
    expect(transitionAssignment([record('A', 'alex')], [van('A', 'alex')], request('A', 'alex', '2026-09-23T08:00:00.000Z')).assignments).toHaveLength(1);
    expect(() => transitionAssignment([], [van('A')], request('A', 'alex', 'invalid'))).toThrow();
  });

  it('rejects a backdate before a later closed interval', () => {
    const past = { ...record('A', 'beth'), endedAt: '2026-09-23T09:00:00.000Z' };
    expect(() => transitionAssignment([past], [van('A')], request('A', 'alex', '2026-09-23T07:00:00.000Z'))).toThrow(/overlap/i);
  });

  it('rejects a future start time', () => {
    expect(() => transitionAssignment([], [van('A')], request('A', 'alex', '2026-09-23T11:00:00.000Z'))).toThrow(/future/i);
  });

  it('corrects the start of the same active assignment without duplicating it', () => {
    const result = transitionAssignment([record('A', 'alex')], [van('A', 'alex')], request('A', 'alex', '2026-09-23T07:30:00.000Z'));
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({ startedAt: '2026-09-23T07:30:00.000Z', actorId: 'boss' });
    expect(result.vehicles[0].currentUserStartAt).toBe('2026-09-23T07:30:00.000Z');
  });
  it('does not change checkout time when an employee checks out the same van again', () => {
    const result = transitionAssignment([record('A', 'alex')], [van('A', 'alex')], { ...request('A', 'alex'), source: 'employee' });
    expect(result.assignments[0].startedAt).toBe('2026-09-23T08:00:00.000Z');
  });
});
