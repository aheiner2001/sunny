import { describe, expect, it } from 'vitest';
import {
  buildTraineeLearnRows,
  employeeOverviewLabel,
  employeeOverviewStatus,
  trainingStatusLabel,
  trainingStatusTone,
} from '../trainingProgress';
import type { TrainingAssignment, TrainingItem } from '../types';

const items: TrainingItem[] = [
  {
    id: 'i1',
    title: 'Cab',
    order: 1,
    active: true,
    deadlineType: 'within_days',
    withinDays: 7,
    retrainThreshold: 2,
    linkedQuestionIds: [],
    createdAt: '2026-10-26T12:00:00Z',
    updatedAt: '2026-10-26T12:00:00Z',
  },
  {
    id: 'i2',
    title: 'Gear',
    order: 2,
    active: true,
    deadlineType: 'within_days',
    withinDays: 7,
    retrainThreshold: 2,
    linkedQuestionIds: [],
    createdAt: '2026-10-26T12:00:00Z',
    updatedAt: '2026-10-26T12:00:00Z',
  },
];

const asg = (
  traineeId: string,
  itemId: string,
  status: TrainingAssignment['status'],
): TrainingAssignment => ({
  id: `${traineeId}-${itemId}`,
  traineeId,
  traineeName: traineeId,
  itemId,
  status,
  dueAt: null,
  missStreak: 0,
  events: [],
  createdAt: '2026-10-26T12:00:00Z',
  updatedAt: '2026-10-26T12:00:00Z',
});

describe('buildTraineeLearnRows', () => {
  it('shows who is fully trained vs in progress with clear percents', () => {
    const rows = buildTraineeLearnRows({
      employees: [
        { id: 'a', name: 'Alex' },
        { id: 'b', name: 'Sam' },
      ],
      items,
      assignments: [
        asg('a', 'i1', 'completed'),
        asg('a', 'i2', 'completed'),
        asg('b', 'i1', 'overdue'),
      ],
    });

    expect(rows[0]).toMatchObject({
      traineeName: 'Alex',
      completed: 2,
      percentComplete: 100,
      headlineStatus: 'trained',
      hasNeedsRetrain: false,
    });
    expect(employeeOverviewStatus(rows[0])).toBe('up_to_date');
    expect(employeeOverviewLabel('up_to_date')).toBe('Up to date');
    expect(rows[1]).toMatchObject({
      traineeName: 'Sam',
      completed: 0,
      inProgress: 1,
      notStarted: 1,
      percentComplete: 0,
      headlineStatus: 'needs_attention',
    });
    expect(employeeOverviewStatus(rows[1])).toBe('needs_training');
  });

  it('flags needs retrain on the people overview when an item needs retrain', () => {
    const rows = buildTraineeLearnRows({
      employees: [{ id: 'a', name: 'Alex' }],
      items,
      assignments: [asg('a', 'i1', 'needs_retrain'), asg('a', 'i2', 'completed')],
    });
    expect(rows[0].hasNeedsRetrain).toBe(true);
    expect(employeeOverviewStatus(rows[0])).toBe('needs_retrain');
  });

  it('maps assignment statuses to badge tones and labels', () => {
    expect(trainingStatusTone('completed')).toBe('ok');
    expect(trainingStatusLabel('completed')).toBe('Trained');
    expect(trainingStatusTone('needs_retrain')).toBe('critical');
    expect(trainingStatusLabel('awaiting_trainee')).toBe('Awaiting certify');
  });
});
