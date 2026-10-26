import { describe, expect, it } from 'vitest';
import { buildPreviousUserAccountabilityFlags } from '../previousUserAccountability';
import type { ChecklistQuestion, Inspection, InspectionAlert, VehicleAssignment } from '@/types';

const question = (overrides: Partial<ChecklistQuestion> = {}): ChecklistQuestion => ({
  id: 'cab-clean',
  category: 'interior',
  text: 'Is the cab clean?',
  type: 'yes_no',
  required: true,
  order: 1,
  holdPreviousUserAccountable: true,
  previousUserMessage: 'Clean the cab before you leave.',
  ...overrides,
});

const inspection = {
  id: 'insp-1',
  vehicleId: 'van',
  vehicleNumber: '5',
  userId: 'jacob',
  userName: 'Jacob',
  userEmail: 'j@x.com',
  status: 'issues_found',
  startedAt: '2026-09-29T14:30:00Z',
  startedAtRecorded: true,
  submittedAt: '2026-09-29T14:37:06Z',
  dateString: '2026-09-29',
  responses: [
    {
      questionId: 'cab-clean',
      questionText: 'Is the cab clean?',
      category: 'interior',
      value: 'no',
      isFlagged: true,
    },
  ],
  issueIds: [],
} as Inspection;

const alert = {
  inspectionId: 'insp-1',
  vehicleId: 'van',
  inspectionKind: 'pretrip',
  reportedById: 'jacob',
  reportedAt: '2026-09-29T14:37:06Z',
} as InspectionAlert;

const previousAssignment: VehicleAssignment = {
  id: 'prev',
  vehicleId: 'van',
  vehicleNumber: '5',
  userId: 'alex',
  userName: 'Alex',
  startedAt: '2026-09-28T14:00:00Z',
  endedAt: '2026-09-29T00:00:00Z',
  source: 'manager',
  actorId: 'manager',
  actorName: 'Manager',
  recordedAt: '2026-09-28T14:00:00Z',
};

describe('buildPreviousUserAccountabilityFlags', () => {
  it('creates an open flag for the previous user when an accountable question is answered No', () => {
    const flags = buildPreviousUserAccountabilityFlags({
      inspection,
      alert,
      questions: [question()],
      assignments: [previousAssignment],
      inspections: [],
      now: '2026-09-29T14:37:06Z',
    });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      employeeId: 'alex',
      employeeName: 'Alex',
      vehicleId: 'van',
      vehicleNumber: '5',
      questionId: 'cab-clean',
      questionText: 'Is the cab clean?',
      inspectionId: 'insp-1',
      message: 'Clean the cab before you leave.',
      status: 'open',
    });
  });

  it('skips questions that are not opted into previous-user accountability', () => {
    const flags = buildPreviousUserAccountabilityFlags({
      inspection,
      alert,
      questions: [question({ holdPreviousUserAccountable: false })],
      assignments: [previousAssignment],
      inspections: [],
      now: '2026-09-29T14:37:06Z',
    });
    expect(flags).toEqual([]);
  });

  it('skips when the answer is not an issue even if the question is accountable', () => {
    const clean = {
      ...inspection,
      responses: [{ ...inspection.responses[0], value: 'yes', isFlagged: false }],
      status: 'passed',
    } as Inspection;
    const flags = buildPreviousUserAccountabilityFlags({
      inspection: clean,
      alert,
      questions: [question()],
      assignments: [previousAssignment],
      inspections: [],
      now: '2026-09-29T14:37:06Z',
    });
    expect(flags).toEqual([]);
  });

  it('creates no flags when previous user cannot be resolved', () => {
    const flags = buildPreviousUserAccountabilityFlags({
      inspection,
      alert,
      questions: [question()],
      assignments: [],
      inspections: [],
      now: '2026-09-29T14:37:06Z',
    });
    expect(flags).toEqual([]);
  });
});
