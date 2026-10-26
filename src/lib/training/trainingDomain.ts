import { DateTime } from 'luxon';
import type {
  TrainingAssignment,
  TrainingEvent,
  TrainingItem,
} from './types';

const ZONE = 'America/Denver';

export function computeTrainingDueAt(
  item: Pick<TrainingItem, 'deadlineType' | 'withinDays'>,
  fromIso: string,
): string | null {
  const start = DateTime.fromISO(fromIso, { zone: ZONE });
  if (!start.isValid) return null;
  if (item.deadlineType === 'end_of_day') {
    return start.endOf('day').toUTC().toISO();
  }
  const days = Math.max(1, Number(item.withinDays) || 7);
  return start.plus({ days }).endOf('day').toUTC().toISO();
}

export function appendTrainingEvent(
  assignment: TrainingAssignment,
  event: TrainingEvent,
): TrainingAssignment {
  return {
    ...assignment,
    events: [...assignment.events, event],
    updatedAt: event.at,
  };
}

export function applyTrainerSignOff(
  assignment: TrainingAssignment,
  actor: { id: string; name: string },
  at: string,
  note?: string,
): TrainingAssignment {
  if (assignment.status === 'completed') {
    throw new Error('Training item is already completed.');
  }
  if (assignment.status === 'awaiting_trainee') {
    throw new Error('Trainer already signed off; waiting for trainee certification.');
  }
  // assigned | overdue | needs_retrain may receive a (re)sign-off.
  const next = appendTrainingEvent(assignment, {
    id: `tev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'trainer_signoff',
    at,
    actorId: actor.id,
    actorName: actor.name,
    note,
  });
  return { ...next, status: 'awaiting_trainee' };
}

export function applyTraineeCertify(
  assignment: TrainingAssignment,
  actor: { id: string; name: string },
  at: string,
): TrainingAssignment {
  if (assignment.traineeId !== actor.id) {
    throw new Error('Only the assigned trainee can certify this item.');
  }
  if (assignment.status !== 'awaiting_trainee') {
    throw new Error('Trainer must sign off before the trainee can certify.');
  }
  const next = appendTrainingEvent(assignment, {
    id: `tev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'trainee_certify',
    at,
    actorId: actor.id,
    actorName: actor.name,
  });
  return { ...next, status: 'completed', missStreak: 0 };
}

export function applyTrainingMiss(
  assignment: TrainingAssignment,
  item: Pick<TrainingItem, 'retrainThreshold'>,
  actor: { id: string; name: string },
  at: string,
): TrainingAssignment {
  const streak = assignment.missStreak + 1;
  let next = appendTrainingEvent(assignment, {
    id: `tev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'miss',
    at,
    actorId: actor.id,
    actorName: actor.name,
  });
  next = { ...next, missStreak: streak };
  const wasCompleted =
    assignment.status === 'completed' || assignment.events.some(e => e.type === 'trainee_certify');
  if (wasCompleted && streak >= Math.max(1, item.retrainThreshold)) {
    next = appendTrainingEvent(next, {
      id: `tev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'retrain_required',
      at,
      actorId: 'system',
      actorName: 'System',
      note: `Miss streak reached ${streak}`,
    });
    return { ...next, status: 'needs_retrain' };
  }
  return next;
}

export function markOverdueIfNeeded(assignment: TrainingAssignment, nowIso: string): TrainingAssignment {
  if (!assignment.dueAt) return assignment;
  if (assignment.status === 'completed' || assignment.status === 'needs_retrain') return assignment;
  if (Date.parse(assignment.dueAt) >= Date.parse(nowIso)) return assignment;
  if (assignment.status === 'overdue') return assignment;
  return appendTrainingEvent(
    { ...assignment, status: 'overdue' },
    {
      id: `tev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'deadline_passed',
      at: nowIso,
      actorId: 'system',
      actorName: 'System',
    },
  );
}
