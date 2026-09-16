import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '@/lib/db';

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

describe('return jobs → setVehicleJobsToday', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setVehicleJobsToday updates day log and lifespan delta', async () => {
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
          currentUserStartAt: new Date().toISOString(),
        },
      ])
    );
    localStorage.setItem(
      'sunny_equipment',
      JSON.stringify([
        {
          id: 'eq-brush',
          name: 'Brush',
          category: 'equipment',
          vehicleId: 'van-1',
          status: 'working',
          lifespanEnabled: true,
          lifespanMode: 'usage',
          expectedCars: 100,
          carsUsed: 0,
          lifespanStatus: 'ok',
        },
      ])
    );
    localStorage.setItem('sunny_vehicle_day_logs', JSON.stringify([]));

    expect(dbService.getTodayJobsCount('van-1')).toBe(0);

    await dbService.setVehicleJobsToday('van-1', 3, { id: 'sam', name: 'Sam' });

    expect(dbService.getTodayJobsCount('van-1')).toBe(3);
    expect(dbService.getEquipmentItem('eq-brush')?.carsUsed).toBe(3);
  });
});
