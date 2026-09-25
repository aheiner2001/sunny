import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';

const commit = vi.fn();
vi.mock('../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  setDoc: vi.fn().mockResolvedValue(undefined), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit })),
}));

const payload = { vehicleId: 'A', userId: 'alex', userName: 'Alex', userEmail: '', responses: [], flaggedIssues: [] };

describe('online inspection submission', () => {
  beforeEach(() => {
    localStorage.clear();
    (dbService as any).inspectionMemory = null;
    (dbService as any).confirmedInspections = new Map();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_vehicles', JSON.stringify([{ id: 'A', vehicleNumber: 'A', name: 'A', licensePlate: 'A', qrCodeToken: 'A', status: 'active' }]));
    commit.mockReset().mockResolvedValue(undefined);
  });

  it('does not report success or check out the van if Firestore rejects the inspection', async () => {
    commit.mockRejectedValueOnce(new Error('Firestore quota exceeded'));
    await expect(dbService.submitInspection(payload)).rejects.toThrow('Firestore quota exceeded');
    expect(dbService.getInspections()).toHaveLength(0);
    expect(dbService.getVehicle('A')?.currentUserId).toBeFalsy();
  });

  it('reports a completed inspection only after the cloud batch succeeds', async () => {
    let finish!: () => void;
    commit.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const submitting = dbService.submitInspection(payload);
    expect(dbService.getInspections()).toHaveLength(0);
    finish();
    const result = await submitting;
    expect(result.inspection.vehicleId).toBe('A');
    expect(dbService.getInspections()).toHaveLength(1);
  });

  it('reports a confirmed cloud save even if the phone cannot write its inspection cache', async () => {
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'sunny_inspections') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    try {
      const result = await dbService.submitInspection(payload);
      expect(result.localCacheWarning).toBe(true);
      expect(dbService.getInspections().some(item => item.id === result.inspection.id)).toBe(true);
      expect(dbService.getVehicle('A')?.currentUserId).toBe('alex');
      expect(commit).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
