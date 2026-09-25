import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';

const listeners = new Map<string, (snapshot: any) => void>();
const batchSet = vi.fn();
vi.mock('../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  setDoc: vi.fn().mockResolvedValue(undefined), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(),
  onSnapshot: (ref: { path: string }, cb: (snapshot: any) => void) => { listeners.set(ref.path, cb); return () => {}; },
  writeBatch: vi.fn(() => ({ set: batchSet, commit: vi.fn().mockResolvedValue(undefined) })),
}));

describe('Firestore assignment snapshot ordering', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_vehicles', JSON.stringify([]));
    batchSet.mockClear();
  });

  it('waits for assignment snapshot before migrating an occupied vehicle', async () => {
    await dbService.setupFirestoreListeners();
    const vehicle = { id: 'A', vehicleNumber: 'A', name: 'A', licensePlate: 'A', qrCodeToken: 'A', status: 'in_use', currentUserId: 'alex', currentUserName: 'Alex', currentUserStartAt: '2026-09-23T08:00:00.000Z' };
    listeners.get('vehicles')?.({ empty: false, forEach: (cb: (doc: any) => void) => cb({ data: () => vehicle }) });
    expect(dbService.getVehicleAssignments('A')).toHaveLength(0);
    const assignment = { id: 'existing-uuid', vehicleId: 'A', vehicleNumber: 'A', userId: 'alex', userName: 'Alex', startedAt: vehicle.currentUserStartAt, endedAt: null, source: 'employee', actorId: 'alex', actorName: 'Alex', recordedAt: vehicle.currentUserStartAt };
    listeners.get('vehicleAssignments')?.({ forEach: (cb: (doc: any) => void) => cb({ data: () => assignment }) });
    expect(dbService.getVehicleAssignments('A').map(item => item.id)).toEqual(['existing-uuid']);
  });

  it('writes the previous van and its closed interval when an inspection changes vans', async () => {
    await dbService.setupFirestoreListeners();
    const start = new Date(Date.now() - 60_000).toISOString();
    const a = { id: 'A', vehicleNumber: 'A', name: 'A', licensePlate: 'A', qrCodeToken: 'A', status: 'in_use', currentUserId: 'alex', currentUserName: 'Alex', currentUserStartAt: start };
    const b = { id: 'B', vehicleNumber: 'B', name: 'B', licensePlate: 'B', qrCodeToken: 'B', status: 'active' };
    listeners.get('vehicles')?.({ empty: false, forEach: (cb: (doc: any) => void) => [a, b].forEach(vehicle => cb({ data: () => vehicle })) });
    const original = { id: 'old-uuid', vehicleId: 'A', vehicleNumber: 'A', userId: 'alex', userName: 'Alex', startedAt: start, endedAt: null, source: 'employee', actorId: 'alex', actorName: 'Alex', recordedAt: start };
    listeners.get('vehicleAssignments')?.({ forEach: (cb: (doc: any) => void) => cb({ data: () => original }) });
    await dbService.submitInspection({ vehicleId: 'B', userId: 'alex', userName: 'Alex', userEmail: '', responses: [], flaggedIssues: [] });
    expect(batchSet.mock.calls.some(([ref]) => ref.path === 'inspections')).toBe(true);
    expect(batchSet.mock.calls.some(([ref, data]) => ref.path === 'vehicles' && ref.id === 'B' && data.currentUserId === 'alex')).toBe(true);
    expect(batchSet.mock.calls.some(([ref, data]) => ref.path === 'vehicles' && ref.id === 'A' && data.currentUserId === null)).toBe(true);
    expect(batchSet.mock.calls.some(([ref, data]) => ref.path === 'vehicleAssignments' && ref.id === 'old-uuid' && Boolean(data.endedAt))).toBe(true);
  });
});
