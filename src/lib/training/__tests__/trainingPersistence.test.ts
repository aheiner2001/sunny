import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn().mockRejectedValue(new Error('Firestore permission denied'));
const batchSet = vi.fn();
const batchDelete = vi.fn();
const listeners = new Map<string, (snapshot: unknown) => void>();
const listenerOptions = new Map<string, { includeMetadataChanges?: boolean }>();
vi.mock('../../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue({ uid: 'test' }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ forEach: () => {}, empty: true })),
  updateDoc: vi.fn(),
  onSnapshot: (
    ref: { path: string },
    optionsOrCallback: { includeMetadataChanges?: boolean } | ((snapshot: unknown) => void),
    maybeCallback?: (snapshot: unknown) => void,
  ) => {
    const callback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : (maybeCallback as (snapshot: unknown) => void);
    if (typeof optionsOrCallback !== 'function') {
      listenerOptions.set(ref.path, optionsOrCallback);
    }
    listeners.set(ref.path, callback);
    return () => {};
  },
  writeBatch: vi.fn(() => ({ set: batchSet, delete: batchDelete, commit })),
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
    batchDelete.mockReset();
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

  it('persists trainee↔trainer pairing after a successful cloud write', async () => {
    commit.mockResolvedValueOnce(undefined);
    await dbService.saveTraineeTrainerLink({
      traineeId: 'emp-2',
      trainerIds: ['emp-1'],
      updatedAt: '2026-10-26T12:00:00Z',
    });
    expect(dbService.getTraineeTrainerLinks()).toEqual([
      { traineeId: 'emp-2', trainerIds: ['emp-1'], updatedAt: '2026-10-26T12:00:00Z' },
    ]);
  });

  it('registers training listeners with includeMetadataChanges', () => {
    for (const path of ['trainingItems', 'trainingAssignments', 'traineeTrainers', 'previousUserFlags']) {
      expect(listenerOptions.get(path)).toEqual({ includeMetadataChanges: true });
    }
  });

  it('ignores optimistic trainingItems snapshots while writes are pending', () => {
    dbService.getTrainingItems();
    expect(dbService.getTrainingItems()).toHaveLength(0);
    listeners.get('trainingItems')?.({
      empty: false,
      metadata: { hasPendingWrites: true },
      forEach: (cb: (doc: { data: () => TrainingItem }) => void) => cb({ data: () => item() }),
    });
    expect(dbService.getTrainingItems()).toHaveLength(0);
  });

  it('hydrates trainingItems after pending writes are acknowledged', () => {
    dbService.getTrainingItems();
    const fire = (hasPendingWrites: boolean) =>
      listeners.get('trainingItems')?.({
        empty: false,
        metadata: { hasPendingWrites },
        forEach: (cb: (doc: { data: () => TrainingItem }) => void) => cb({ data: () => item() }),
      });
    fire(true);
    expect(dbService.getTrainingItems()).toHaveLength(0);
    fire(false);
    expect(dbService.getTrainingItems()).toHaveLength(1);
    expect(dbService.getTrainingItems()[0].title).toBe('Cab cleanliness');
  });
});
