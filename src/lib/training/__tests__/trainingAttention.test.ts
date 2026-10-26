import { describe, expect, it } from 'vitest';
import { buildTrainingAttentionRows, buildTrainerSignOffQueue } from '../trainingAttention';
import type { TrainingAssignment } from '../types';

const base = (overrides: Partial<TrainingAssignment>): TrainingAssignment => ({
  id: 'a1',
  traineeId: 'emp-2',
  traineeName: 'Sam',
  itemId: 'item-1',
  status: 'assigned',
  dueAt: null,
  missStreak: 0,
  events: [],
  createdAt: '2026-10-26T12:00:00Z',
  updatedAt: '2026-10-26T12:00:00Z',
  ...overrides,
});

describe('buildTrainingAttentionRows', () => {
  it('buckets assigned/overdue as awaiting_trainer, awaiting_trainee as awaiting_employee, needs_retrain separately', () => {
    const rows = buildTrainingAttentionRows([
      base({ id: '1', status: 'assigned' }),
      base({ id: '2', status: 'overdue' }),
      base({ id: '3', status: 'awaiting_trainee' }),
      base({ id: '4', status: 'needs_retrain' }),
      base({ id: '5', status: 'completed' }),
    ]);
    expect(rows.map(r => [r.assignment.id, r.bucket])).toEqual([
      ['4', 'needs_retrain'],
      ['2', 'awaiting_trainer'],
      ['1', 'awaiting_trainer'],
      ['3', 'awaiting_employee'],
    ]);
  });
});

describe('buildTrainerSignOffQueue', () => {
  it('returns only paired trainees needing trainer sign-off', () => {
    const queue = buildTrainerSignOffQueue({
      trainerId: 'emp-1',
      links: [{ traineeId: 'emp-2', trainerIds: ['emp-1'] }],
      assignments: [
        base({ id: 'keep', traineeId: 'emp-2', status: 'assigned' }),
        base({ id: 'other', traineeId: 'emp-3', status: 'assigned' }),
        base({ id: 'waiting', traineeId: 'emp-2', status: 'awaiting_trainee' }),
      ],
    });
    expect(queue.map(a => a.id)).toEqual(['keep']);
  });
});
