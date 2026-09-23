import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';

vi.mock('../firebase', () => ({ db: null, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn() }));

const van = (id: string, employee?: string) => ({
  id, vehicleNumber: id, name: id, licensePlate: id, qrCodeToken: id,
  status: employee ? 'in_use' : 'active', currentUserId: employee || null,
  currentUserName: employee || null, currentUserStartAt: employee ? '2026-09-23T08:00:00.000Z' : null,
});

describe('manager vehicle assignment', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_vehicles', JSON.stringify([van('A'), van('B')]));
    localStorage.setItem('sunny_users', JSON.stringify([
      { id: 'boss', name: 'Manager', role: 'manager', status: 'active' },
      { id: 'alex', name: 'Alex', role: 'employee', status: 'active' },
    ]));
  });

  it('assigns without creating an inspection and moves the driver across vans', async () => {
    const actor = { id: 'boss', name: 'Manager' };
    await dbService.assignVehicle('A', 'alex', '2026-09-23T09:00:00.000Z', actor);
    await dbService.assignVehicle('B', 'alex', '2026-09-23T10:00:00.000Z', actor);
    expect(dbService.getVehicle('A')?.currentUserId).toBeNull();
    expect(dbService.getVehicle('B')?.currentUserId).toBe('alex');
    expect(dbService.getVehicleAssignments('A')[0].endedAt).toBe('2026-09-23T10:00:00.000Z');
    expect(dbService.getVehicleAssignments('B')[0].actorId).toBe('boss');
    expect(dbService.getInspections()).toHaveLength(0);
  });

  it('migrates occupied vans once and closes history on release', async () => {
    localStorage.setItem('sunny_vehicles', JSON.stringify([van('A', 'alex')]));
    expect(dbService.getVehicleAssignments('A')).toHaveLength(1);
    expect(dbService.getVehicleAssignments('A')).toHaveLength(1);
    await dbService.releaseVehicle('A', '2026-09-23T10:00:00.000Z', { id: 'boss', name: 'Manager' });
    expect(dbService.getVehicleAssignments('A')[0].endedAt).toBe('2026-09-23T10:00:00.000Z');
  });

  it('rejects a non-manager or inactive employee', async () => {
    await expect(dbService.assignVehicle('A', 'alex', '2026-09-23T09:00:00.000Z', { id: 'alex', name: 'Alex' })).rejects.toThrow();
    localStorage.setItem('sunny_users', JSON.stringify([{ id: 'boss', name: 'Manager', role: 'manager', status: 'active' }, { id: 'alex', name: 'Alex', role: 'employee', status: 'inactive' }]));
    await expect(dbService.assignVehicle('A', 'alex', '2026-09-23T09:00:00.000Z', { id: 'boss', name: 'Manager' })).rejects.toThrow();
  });
});
