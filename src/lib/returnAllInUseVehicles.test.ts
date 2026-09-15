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

const van = (over: Record<string, unknown> = {}) => ({
  id: 'van-1',
  vehicleNumber: 'Van #1',
  name: 'Transit',
  licensePlate: 'ABC',
  qrCodeToken: 'van-1',
  status: 'in_use',
  currentUserId: 'sam',
  currentUserName: 'Sam',
  currentUserStartAt: new Date().toISOString(),
  currentUserStartTime: '9:00 AM',
  ...over,
});

describe('returnAllInUseVehicles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears every driver without creating missed returns', async () => {
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem(
      'sunny_vehicles',
      JSON.stringify([
        van(),
        van({ id: 'van-2', vehicleNumber: 'Van #2', qrCodeToken: 'van-2', currentUserId: 'alex', currentUserName: 'Alex' }),
        van({ id: 'van-3', vehicleNumber: 'Van #3', qrCodeToken: 'van-3', status: 'active', currentUserId: null, currentUserName: null, currentUserStartAt: null }),
      ])
    );

    const result = await dbService.returnAllInUseVehicles();
    expect(result.count).toBe(2);
    const list = JSON.parse(localStorage.getItem('sunny_vehicles') || '[]');
    expect(list.every((v: { currentUserId: string | null }) => !v.currentUserId)).toBe(true);
    expect(list.find((v: { id: string }) => v.id === 'van-1').status).toBe('active');
    expect(dbService.getMissedReturns()).toEqual([]);
  });

  it('returns zero when nobody is checked out', async () => {
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem(
      'sunny_vehicles',
      JSON.stringify([van({ status: 'active', currentUserId: null, currentUserName: null, currentUserStartAt: null })])
    );
    const result = await dbService.returnAllInUseVehicles();
    expect(result.count).toBe(0);
  });
});
