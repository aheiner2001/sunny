import { describe, expect, it } from 'vitest';
import {
  buildNewTrainingItem,
  buildTrainingAssignment,
  formatTrainingActionError,
  traineesForAssigner,
  updateTrainingItemSettings,
} from '../trainingUi';
import type { TrainingItem } from '../types';

const item = (overrides: Partial<TrainingItem> = {}): TrainingItem => ({
  id: 'item-1',
  title: 'Cab cleanliness',
  order: 1,
  active: true,
  deadlineType: 'within_days',
  withinDays: 7,
  retrainThreshold: 2,
  linkedQuestionIds: [],
  createdAt: '2026-10-26T12:00:00Z',
  updatedAt: '2026-10-26T12:00:00Z',
  ...overrides,
});

describe('trainingUi helpers', () => {
  it('rejects blank curriculum titles with a clear error', () => {
    expect(buildNewTrainingItem('   ', 1, '2026-10-26T12:00:00Z')).toEqual({
      error: 'Enter a training step title before adding.',
    });
  });

  it('builds a curriculum item ready to persist', () => {
    const next = buildNewTrainingItem('Cab wipe-down', 3, '2026-10-26T12:00:00Z');
    expect(next).toMatchObject({
      title: 'Cab wipe-down',
      order: 3,
      withinDays: 7,
      retrainThreshold: 2,
      active: true,
    });
  });

  it('builds an assignment for a chosen trainee (not a hardcoded first user)', () => {
    const row = buildTrainingAssignment({
      item: item(),
      trainee: { id: 'emp-2', name: 'Sam' },
      actor: { id: 'mgr-1', name: 'Morgan' },
      nowIso: '2026-10-26T12:00:00Z',
    });
    expect(row.traineeId).toBe('emp-2');
    expect(row.traineeName).toBe('Sam');
    expect(row.status).toBe('assigned');
    expect(row.events[0]?.type).toBe('assigned');
  });

  it('clamps curriculum deadline and retrain settings', () => {
    expect(
      updateTrainingItemSettings(item(), { withinDays: 0, retrainThreshold: 99 }, '2026-10-26T13:00:00Z'),
    ).toMatchObject({ withinDays: 1, retrainThreshold: 20, updatedAt: '2026-10-26T13:00:00Z' });
  });

  it('surfaces Firestore errors for primary actions', () => {
    expect(formatTrainingActionError(new Error('permission denied'), 'fallback')).toBe(
      'permission denied',
    );
    expect(formatTrainingActionError('x', 'Could not save training step.')).toBe(
      'Could not save training step.',
    );
  });

  it('narrows assignable trainees to a trainer’s paired list when links exist', () => {
    const employees = [
      { id: 'a', name: 'Alex' },
      { id: 'b', name: 'Sam' },
    ];
    expect(
      traineesForAssigner({
        employees,
        links: [{ traineeId: 'b', trainerIds: ['trainer-1'] }],
        assignerId: 'trainer-1',
        isManager: false,
      }),
    ).toEqual([{ id: 'b', name: 'Sam' }]);
    expect(
      traineesForAssigner({
        employees,
        links: [{ traineeId: 'b', trainerIds: ['trainer-1'] }],
        assignerId: 'trainer-1',
        isManager: true,
      }),
    ).toEqual(employees);
  });
});
