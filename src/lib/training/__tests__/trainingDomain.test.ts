import { describe, expect, it } from 'vitest';
import {
  applyTrainerSignOff,
  applyTraineeCertify,
  applyTrainingMiss,
  computeTrainingDueAt,
  markOverdueIfNeeded,
} from '../trainingDomain';
import type { TrainingAssignment, TrainingItem } from '../types';

const item = (overrides: Partial<TrainingItem> = {}): TrainingItem => ({
  id: 'item-cab',
  title: 'Cab cleanliness',
  order: 1,
  active: true,
  deadlineType: 'within_days',
  withinDays: 7,
  retrainThreshold: 2,
  linkedQuestionIds: ['cab-clean'],
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  ...overrides,
});

const assignment = (overrides: Partial<TrainingAssignment> = {}): TrainingAssignment => ({
  id: 'asg-1',
  traineeId: 'alex',
  traineeName: 'Alex',
  itemId: 'item-cab',
  status: 'assigned',
  dueAt: '2026-10-08T05:59:59.999Z',
  missStreak: 0,
  events: [],
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  ...overrides,
});

describe('training domain', () => {
  it('computes end-of-day and within-days due times in America/Denver', () => {
    const eod = computeTrainingDueAt({ deadlineType: 'end_of_day' }, '2026-10-26T18:00:00-06:00');
    expect(eod).toMatch(/2026-10-27T05:59:59/);
    const week = computeTrainingDueAt({ deadlineType: 'within_days', withinDays: 7 }, '2026-10-26T12:00:00-06:00');
    expect(week).toBeTruthy();
  });

  it('requires trainer sign-off before trainee certify and keeps events append-only', () => {
    const signed = applyTrainerSignOff(assignment(), { id: 'trainer', name: 'Pat' }, '2026-10-26T15:00:00Z');
    expect(signed.status).toBe('awaiting_trainee');
    expect(signed.events).toHaveLength(1);
    const certified = applyTraineeCertify(signed, { id: 'alex', name: 'Alex' }, '2026-10-26T16:00:00Z');
    expect(certified.status).toBe('completed');
    expect(certified.events.map(e => e.type)).toEqual(['trainer_signoff', 'trainee_certify']);
    expect(signed.events).toHaveLength(1);
  });

  it('marks needs_retrain after consecutive misses once previously certified', () => {
    let row = applyTrainerSignOff(assignment(), { id: 'trainer', name: 'Pat' }, '2026-10-20T15:00:00Z');
    row = applyTraineeCertify(row, { id: 'alex', name: 'Alex' }, '2026-10-20T16:00:00Z');
    expect(row.status).toBe('completed');
    row = applyTrainingMiss(row, item(), { id: 'system', name: 'Inspection' }, '2026-10-25T12:00:00Z');
    expect(row.missStreak).toBe(1);
    expect(row.status).toBe('completed');
    row = applyTrainingMiss(row, item(), { id: 'system', name: 'Inspection' }, '2026-10-26T12:00:00Z');
    expect(row.missStreak).toBe(2);
    expect(row.status).toBe('needs_retrain');
    expect(row.events.some(e => e.type === 'retrain_required')).toBe(true);
  });

  it('marks overdue without rewriting completed work', () => {
    const overdue = markOverdueIfNeeded(
      assignment({ dueAt: '2026-10-01T12:00:00Z' }),
      '2026-10-26T12:00:00Z',
    );
    expect(overdue.status).toBe('overdue');
    const done = markOverdueIfNeeded(
      assignment({ status: 'completed', dueAt: '2026-10-01T12:00:00Z' }),
      '2026-10-26T12:00:00Z',
    );
    expect(done.status).toBe('completed');
  });
});
