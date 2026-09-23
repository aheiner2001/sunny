import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '@/lib/db';
import { localDateString } from '@/lib/occupancy';

vi.mock('@/lib/firebase', () => ({
  db: null,
  ensureAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

describe('overnight missed returns + submitReturnInspection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a pending missed return when overnight-clearing a van without a return', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yIso = yesterday.toISOString();
    const yDay = localDateString(yesterday);

    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem(
      'sunny_vehicles',
      JSON.stringify([
        {
          id: 'van-1',
          vehicleNumber: 'Van #1',
          name: 'Transit',
          licensePlate: 'ABC',
          qrCodeToken: 'van-1',
          status: 'in_use',
          currentUserId: 'sam',
          currentUserName: 'Sam',
          currentUserStartAt: yIso,
          currentUserStartTime: '9:00 AM',
        },
      ])
    );
    localStorage.setItem(
      'sunny_inspections',
      JSON.stringify([
        {
          id: 'insp-1',
          vehicleId: 'van-1',
          vehicleNumber: 'Van #1',
          userId: 'sam',
          userName: 'Sam',
          userEmail: 'sam@example.com',
          status: 'passed',
          kind: 'pretrip',
          startedAt: yIso,
          submittedAt: yIso,
          dateString: yDay,
          responses: [],
          issueIds: [],
        },
      ])
    );

    const vehicles = dbService.getVehicles();
    expect(vehicles[0].currentUserId).toBeNull();
    const pending = dbService.getPendingMissedReturnForUser('sam');
    expect(pending).toBeTruthy();
    expect(pending?.vehicleId).toBe('van-1');
    expect(pending?.status).toBe('pending');
    expect(dbService.getVehicleAssignments('van-1')[0]?.endedAt).toBeTruthy();
  });

  it('submitReturnInspection clears occupancy and sets kind return', () => {
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem(
      'sunny_vehicles',
      JSON.stringify([
        {
          id: 'van-2',
          vehicleNumber: 'Van #2',
          name: 'Transit',
          licensePlate: 'DEF',
          qrCodeToken: 'van-2',
          status: 'in_use',
          currentUserId: 'sam',
          currentUserName: 'Sam',
          currentUserStartAt: new Date().toISOString(),
        },
      ])
    );
    localStorage.setItem('sunny_inspections', JSON.stringify([]));

    const result = dbService.submitReturnInspection({
      vehicleId: 'van-2',
      userId: 'sam',
      userName: 'Sam',
      userEmail: 'sam@example.com',
      responses: [],
    });

    expect(result.inspection.kind).toBe('return');
    const van = dbService.getVehicle('van-2');
    expect(van?.currentUserId).toBeNull();
    expect(van?.status).toBe('active');
    expect(dbService.getVehicleAssignments('van-2')[0]?.endedAt).toBeTruthy();
  });
});
