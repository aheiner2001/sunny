import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';

const listeners = new Map<string, (snapshot: any) => void>();
vi.mock('../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  onSnapshot: (ref: { path: string }, callback: (snapshot: any) => void) => { listeners.set(ref.path, callback); return () => {}; },
  setDoc: vi.fn().mockResolvedValue(undefined), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

describe('confirmed inspection snapshots', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sunny_seeded_v2', 'true');
  });

  it('caches small records while keeping full cloud photos available on this page', async () => {
    await dbService.setupFirestoreListeners();
    const photo = 'data:image/jpeg;base64,abc';
    const remote = {
      id: 'insp-1', vehicleId: 'A', vehicleNumber: 'A', userId: 'alex', userName: 'Alex',
      responses: [{ questionId: 'photo', photoUrl: photo }], photoUrls: [photo], signatureBase64: photo,
    };
    listeners.get('inspections')?.({
      empty: false, metadata: { fromCache: false, hasPendingWrites: false },
      forEach: (callback: (doc: any) => void) => callback({ id: 'insp-1', metadata: { hasPendingWrites: false }, data: () => remote }),
    });
    expect(JSON.parse(localStorage.getItem('sunny_inspections')!)[0].responses[0].photoUrl).toBeUndefined();
    expect(dbService.getInspections()[0].responses[0].photoUrl).toBe(photo);
  });
});
