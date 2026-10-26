import { describe, expect, it } from 'vitest';
import {
  buildMissStrikeSlots,
  resolveTrainingMissTargets,
  toggleLinkedQuestionId,
} from '../trainingMissTargets';
import type { TrainingAssignment, TrainingItem } from '../types';
import type { ChecklistQuestion, Inspection, VehicleAssignment } from '@/types';

const item = (overrides: Partial<TrainingItem> = {}): TrainingItem => ({
  id: 'train-caddy',
  title: 'How to use chemical caddy',
  order: 1,
  active: true,
  deadlineType: 'within_days',
  withinDays: 7,
  retrainThreshold: 3,
  linkedQuestionIds: ['q-caddy'],
  createdAt: '2026-10-26T12:00:00Z',
  updatedAt: '2026-10-26T12:00:00Z',
  ...overrides,
});

const question = (overrides: Partial<ChecklistQuestion> = {}): ChecklistQuestion => ({
  id: 'q-caddy',
  category: 'supplies',
  text: 'Chemical caddy: all essentials filled?',
  type: 'yes_no',
  required: true,
  order: 1,
  holdPreviousUserAccountable: true,
  previousUserMessage: 'Refill the chemical caddy before you leave.',
  ...overrides,
});

const assignment = (overrides: Partial<TrainingAssignment> = {}): TrainingAssignment => ({
  id: 'asg-1',
  traineeId: 'prev-driver',
  traineeName: 'Pat',
  itemId: 'train-caddy',
  status: 'completed',
  dueAt: null,
  missStreak: 0,
  events: [],
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  ...overrides,
});

const inspection = (overrides: Partial<Inspection> = {}): Inspection =>
  ({
    id: 'insp-1',
    vehicleId: 'van-1',
    vehicleNumber: '5',
    userId: 'inspector',
    userName: 'Alex',
    status: 'completed',
    type: 'pretrip',
    startedAt: '2026-10-26T14:00:00Z',
    submittedAt: '2026-10-26T14:30:00Z',
    responses: [
      {
        questionId: 'q-caddy',
        questionText: 'Chemical caddy?',
        value: 'no',
        isFlagged: true,
      },
    ],
    ...overrides,
  }) as Inspection;

describe('resolveTrainingMissTargets', () => {
  it('ticks the previous user when a linked previous-user question is flagged', () => {
    const vehicleAssignments: VehicleAssignment[] = [
      {
        id: 'va-1',
        vehicleId: 'van-1',
        vehicleNumber: '5',
        userId: 'prev-driver',
        userName: 'Pat',
        startedAt: '2026-10-26T08:00:00Z',
        endedAt: '2026-10-26T13:00:00Z',
        source: 'employee',
        actorId: 'prev-driver',
        actorName: 'Pat',
        recordedAt: '2026-10-26T08:00:00Z',
      },
    ];

    const targets = resolveTrainingMissTargets({
      items: [item()],
      assignments: [assignment()],
      questions: [question()],
      inspection: inspection(),
      alert: {
        inspectionId: 'insp-1',
        vehicleId: 'van-1',
        inspectionKind: 'pretrip',
        reportedById: 'inspector',
        reportedAt: '2026-10-26T14:30:00Z',
      },
      assignmentsHistory: vehicleAssignments,
      submitterId: 'inspector',
    });

    expect(targets).toEqual([
      {
        itemId: 'train-caddy',
        traineeId: 'prev-driver',
        questionIds: ['q-caddy'],
        reason: 'previous_user',
      },
    ]);
  });

  it('ticks the submitter when the linked question is not previous-user accountable', () => {
    const targets = resolveTrainingMissTargets({
      items: [item()],
      assignments: [assignment({ traineeId: 'inspector', traineeName: 'Alex' })],
      questions: [question({ holdPreviousUserAccountable: false })],
      inspection: inspection(),
      alert: {
        inspectionId: 'insp-1',
        vehicleId: 'van-1',
        inspectionKind: 'pretrip',
        reportedById: 'inspector',
        reportedAt: '2026-10-26T14:30:00Z',
      },
      assignmentsHistory: [],
      submitterId: 'inspector',
    });

    expect(targets).toEqual([
      expect.objectContaining({
        traineeId: 'inspector',
        reason: 'submitter',
      }),
    ]);
  });

  it('skips people who were never assigned that curriculum step', () => {
    const targets = resolveTrainingMissTargets({
      items: [item()],
      assignments: [],
      questions: [question()],
      inspection: inspection(),
      alert: {
        inspectionId: 'insp-1',
        vehicleId: 'van-1',
        inspectionKind: 'pretrip',
        reportedById: 'inspector',
        reportedAt: '2026-10-26T14:30:00Z',
      },
      assignmentsHistory: [
        {
          id: 'va-1',
          vehicleId: 'van-1',
          vehicleNumber: '5',
          userId: 'prev-driver',
          userName: 'Pat',
          startedAt: '2026-10-26T08:00:00Z',
          endedAt: '2026-10-26T13:00:00Z',
          source: 'employee',
          actorId: 'prev-driver',
          actorName: 'Pat',
          recordedAt: '2026-10-26T08:00:00Z',
        },
      ],
      submitterId: 'inspector',
    });
    expect(targets).toEqual([]);
  });
});

describe('link helpers', () => {
  it('toggles linked inspection questions on a curriculum step', () => {
    const on = toggleLinkedQuestionId(item({ linkedQuestionIds: [] }), 'q-caddy', '2026-10-26T15:00:00Z');
    expect(on.linkedQuestionIds).toEqual(['q-caddy']);
    const off = toggleLinkedQuestionId(on, 'q-caddy', '2026-10-26T15:01:00Z');
    expect(off.linkedQuestionIds).toEqual([]);
  });

  it('builds strike slots toward the retrain threshold', () => {
    expect(buildMissStrikeSlots(1, 3)).toEqual({ filled: 1, total: 3, atThreshold: false });
    expect(buildMissStrikeSlots(3, 3)).toEqual({ filled: 3, total: 3, atThreshold: true });
  });
});
