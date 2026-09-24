import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';

const commit = vi.fn().mockRejectedValue(new Error('Firestore permission denied'));
vi.mock('../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  setDoc: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit })),
}));

describe('manager assignment persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_overnight_reconciled', new Date().toLocaleDateString('en-CA'));
    localStorage.setItem('sunny_vehicles', JSON.stringify([{ id: 'A', vehicleNumber: '3', name: 'Van 3', status: 'active', currentUserId: null }]));
    localStorage.setItem('sunny_users', JSON.stringify([
      { id: 'boss', name: 'Manager', role: 'manager', status: 'active' },
      { id: 'goby', name: 'Goby', role: 'employee', status: 'active' },
    ]));
    commit.mockRejectedValue(new Error('Firestore permission denied'));
  });

  it('does not show a successful assignment locally when the shared write fails', async () => {
    await expect(dbService.assignVehicle('A', 'goby', new Date().toISOString(), { id: 'boss', name: 'Manager' }))
      .rejects.toThrow('Firestore permission denied');
    expect(dbService.getVehicle('A')?.currentUserId).toBeNull();
    expect(dbService.getVehicleAssignments('A')).toHaveLength(0);
  });

  it('updates vehicle occupancy and timeline after the shared write succeeds', async () => {
    commit.mockResolvedValueOnce(undefined);
    await dbService.assignVehicle('A', 'goby', new Date().toISOString(), { id: 'boss', name: 'Manager' });
    expect(dbService.getVehicle('A')?.currentUserId).toBe('goby');
    expect(dbService.getVehicle('A')?.status).toBe('in_use');
    expect(dbService.getVehicleAssignments('A')[0].userId).toBe('goby');
  });
});
