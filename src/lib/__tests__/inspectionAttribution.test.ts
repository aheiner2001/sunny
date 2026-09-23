import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';

vi.mock('../firebase', () => ({ db: null, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn() }));

describe('inspection on an employee behalf', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_vehicles', JSON.stringify([{ id: 'A', vehicleNumber: 'Van A', name: 'Van A', licensePlate: 'A', qrCodeToken: 'A', status: 'active' }]));
    localStorage.setItem('sunny_users', JSON.stringify([
      { id: 'boss', name: 'Manager', role: 'manager', status: 'active' },
      { id: 'alex', name: 'Alex', role: 'employee', status: 'active' },
    ]));
  });

  it('keeps the employee as subject and current operator while recording the manager as submitter', () => {
    const { inspection } = dbService.submitInspection({
      vehicleId: 'A', userId: 'alex', userName: 'Alex', userEmail: 'alex@example.com',
      submittedById: 'boss', submittedByName: 'Manager', responses: [], flaggedIssues: [],
    });
    expect(inspection).toMatchObject({ userId: 'alex', submittedById: 'boss', submittedByName: 'Manager' });
    expect(dbService.getVehicle('A')?.currentUserId).toBe('alex');
    expect(dbService.getVehicleAssignments('A')).toHaveLength(1);
  });

  it('rejects an employee submitting on someone else behalf', () => {
    expect(() => dbService.submitInspection({
      vehicleId: 'A', userId: 'alex', userName: 'Alex', userEmail: '',
      submittedById: 'other', submittedByName: 'Other', responses: [], flaggedIssues: [],
    })).toThrow();
  });
  it('releases the employee previous van when inspecting a free van', async () => {
    localStorage.setItem('sunny_vehicles', JSON.stringify([
      { id: 'A', vehicleNumber: 'Van A', name: 'Van A', licensePlate: 'A', qrCodeToken: 'A', status: 'in_use', currentUserId: 'alex', currentUserName: 'Alex', currentUserStartAt: new Date(Date.now() - 60_000).toISOString() },
      { id: 'B', vehicleNumber: 'Van B', name: 'Van B', licensePlate: 'B', qrCodeToken: 'B', status: 'active' },
    ]));
    dbService.submitInspection({ vehicleId: 'B', userId: 'alex', userName: 'Alex', userEmail: '', responses: [], flaggedIssues: [] });
    expect(dbService.getVehicle('A')?.currentUserId).toBeNull();
    expect(dbService.getVehicle('B')?.currentUserId).toBe('alex');
    expect(dbService.getVehicleAssignments('A')[0].endedAt).toBeTruthy();
  });
});
