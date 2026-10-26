import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn().mockRejectedValue(new Error('Firestore permission denied'));
const batchSet = vi.fn();
vi.mock('../../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue({ uid: 'test' }) }));
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

import { dbService } from '../../db';
import type { TrainingItem } from '../types';

const item = (overrides: Partial<TrainingItem> = {}): TrainingItem => ({
  id: 'item-1',
  title: 'Cab cleanliness',
  order: 1,
  active: true,
  deadlineType: 'within_days',
  withinDays: 7,
  retrainThreshold: 2,
  linkedQuestionIds: ['cab-clean'],
  createdAt: '2026-10-26T12:00:00Z',
  updatedAt: '2026-10-26T12:00:00Z',
  ...overrides,
});

describe('training curriculum persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_overnight_reconciled', new Date().toLocaleDateString('en-CA'));
    commit.mockReset();
    batchSet.mockReset();
    commit.mockRejectedValue(new Error('Firestore permission denied'));
  });

  it('does not keep curriculum locally when the shared write fails', async () => {
    await expect(dbService.saveTrainingItems([item()])).rejects.toThrow(/permission denied/i);
    expect(dbService.getTrainingItems()).toHaveLength(0);
  });

  it('lists curriculum after a successful cloud write', async () => {
    commit.mockResolvedValueOnce(undefined);
    await dbService.saveTrainingItems([item()]);
    expect(dbService.getTrainingItems()).toHaveLength(1);
    expect(dbService.getTrainingItems()[0].title).toBe('Cab cleanliness');
  });
});
