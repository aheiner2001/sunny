import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn().mockRejectedValue(new Error('Firestore permission denied'));
const batchSet = vi.fn();
vi.mock('../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue({ uid: 'test' }) }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  writeBatch: vi.fn(() => ({ set: batchSet, commit })),
  arrayUnion: vi.fn(),
  runTransaction: vi.fn(),
}));

import { dbService } from '../db';
import type { PreviousUserFlag } from '@/types';

const sample = (overrides: Partial<PreviousUserFlag> = {}): PreviousUserFlag => ({
  id: 'flag-1',
  employeeId: 'alex',
  employeeName: 'Alex',
  vehicleId: 'van',
  vehicleNumber: '5',
  questionId: 'cab-clean',
  questionText: 'Is the cab clean?',
  inspectionId: 'insp-1',
  message: 'Clean the cab before you leave.',
  status: 'open',
  createdAt: '2026-09-29T14:37:06Z',
  createdById: 'jacob',
  acknowledgedAt: null,
  ...overrides,
});

describe('previous user flag persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_overnight_reconciled', new Date().toLocaleDateString('en-CA'));
    commit.mockReset();
    batchSet.mockReset();
    commit.mockRejectedValue(new Error('Firestore permission denied'));
  });

  it('does not keep flags locally when the shared write fails', async () => {
    await expect(dbService.savePreviousUserFlags([sample()])).rejects.toThrow(/permission denied/i);
    expect(dbService.getOpenPreviousUserFlagsForEmployee('alex')).toHaveLength(0);
  });

  it('lists open flags after a successful cloud write', async () => {
    commit.mockResolvedValueOnce(undefined);
    await dbService.savePreviousUserFlags([sample()]);
    expect(dbService.getOpenPreviousUserFlagsForEmployee('alex')).toHaveLength(1);
    expect(dbService.getOpenPreviousUserFlagsForEmployee('alex')[0].questionId).toBe('cab-clean');
  });

  it('acknowledges the open batch for an employee and persists the clear', async () => {
    commit.mockResolvedValue(undefined);
    await dbService.savePreviousUserFlags([
      sample(),
      sample({ id: 'flag-2', questionId: 'tools', questionText: 'Tools returned?' }),
    ]);
    const cleared = await dbService.acknowledgePreviousUserFlags('alex', '2026-09-30T12:00:00Z');
    expect(cleared).toHaveLength(2);
    expect(cleared.every(f => f.status === 'acknowledged')).toBe(true);
    expect(dbService.getOpenPreviousUserFlagsForEmployee('alex')).toHaveLength(0);
  });
});
