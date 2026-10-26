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

function newEventId(): string {
  return `tev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Manager approves retrain → item goes back to assigned for dual sign-off. */
export function applyApproveRetrain(
  assignment: TrainingAssignment,
  actor: { id: string; name: string },
  at: string,
  item: Pick<TrainingItem, 'deadlineType' | 'withinDays'>,
): TrainingAssignment {
  if (assignment.status !== 'needs_retrain') {
    throw new Error('Only items flagged for retrain can be approved.');
  }
  const next = appendTrainingEvent(assignment, {
    id: newEventId(),
    type: 'retrain_approved',
    at,
    actorId: actor.id,
    actorName: actor.name,
    note: 'Manager approved retrain',
  });
  return {
    ...next,
    status: 'assigned',
    dueAt: computeTrainingDueAt(item, at),
    missStreak: 0,
  };
}

/**
 * Manager can require retrain at any time — even with no miss flags.
 * Reopens completed / needs_retrain work, or creates a fresh assignment.
 */
export function applyManagerRequireRetrain(input: {
  item: TrainingItem;
  trainee: { id: string; name: string };
  actor: { id: string; name: string };
  nowIso: string;
  existing: TrainingAssignment | null;
}): TrainingAssignment {
  const { item, trainee, actor, nowIso, existing } = input;
  if (
    existing &&
    (existing.status === 'assigned' ||
      existing.status === 'awaiting_trainee' ||
      existing.status === 'overdue')
  ) {
    throw new Error('This step is already open for training — no need to re-assign.');
  }

  const event = {
    id: newEventId(),
    type: 'manager_retrain' as const,
    at: nowIso,
    actorId: actor.id,
    actorName: actor.name,
    note: 'Manager required retrain',
  };

  if (existing) {
    const next = appendTrainingEvent(existing, event);
    return {
      ...next,
      status: 'assigned',
      dueAt: computeTrainingDueAt(item, nowIso),
      missStreak: 0,
    };
  }

  return {
    id: `asg-${Date.now()}-${item.id}-${Math.random().toString(36).slice(2, 6)}`,
    traineeId: trainee.id,
    traineeName: trainee.name,
    itemId: item.id,
    status: 'assigned',
    dueAt: computeTrainingDueAt(item, nowIso),
    missStreak: 0,
    events: [event],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Onboard: one assignment per active curriculum step that is not already completed.
 * Skips items that already have a completed assignment for this trainee.
 */
export function buildOnboardingAssignments(input: {
  items: TrainingItem[];
  existing: TrainingAssignment[];
  trainee: { id: string; name: string };
  actor: { id: string; name: string };
  nowIso: string;
}): TrainingAssignment[] {
  const active = input.items.filter(i => i.active).sort((a, b) => a.order - b.order);
  const out: TrainingAssignment[] = [];
  for (const item of active) {
    const alreadyDone = input.existing.some(
      a => a.traineeId === input.trainee.id && a.itemId === item.id && a.status === 'completed',
    );
    if (alreadyDone) continue;
    const open = input.existing.find(
      a =>
        a.traineeId === input.trainee.id &&
        a.itemId === item.id &&
        a.status !== 'completed',
    );
    if (open) continue;
    out.push({
      id: `asg-${Date.now()}-${item.id}-${Math.random().toString(36).slice(2, 6)}`,
      traineeId: input.trainee.id,
      traineeName: input.trainee.name,
      itemId: item.id,
      status: 'assigned',
      dueAt: computeTrainingDueAt(item, input.nowIso),
      missStreak: 0,
      events: [
        {
          id: newEventId(),
          type: 'onboarded',
          at: input.nowIso,
          actorId: input.actor.id,
          actorName: input.actor.name,
          note: 'Assigned via Onboarding',
        },
      ],
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
  }
  return out;
}

/** Veteran shortcut: mark a curriculum step completed without dual sign-off. */
export function buildMarkedTrainedAssignment(input: {
  item: TrainingItem;
  trainee: { id: string; name: string };
  actor: { id: string; name: string };
  nowIso: string;
}): TrainingAssignment {
  return {
    id: `asg-${Date.now()}-${input.item.id}-${Math.random().toString(36).slice(2, 6)}`,
    traineeId: input.trainee.id,
    traineeName: input.trainee.name,
    itemId: input.item.id,
    status: 'completed',
    dueAt: null,
    missStreak: 0,
    events: [
      {
        id: newEventId(),
        type: 'marked_trained',
        at: input.nowIso,
        actorId: input.actor.id,
        actorName: input.actor.name,
        note: 'Manager marked already trained',
      },
    ],
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  };
}

/**
 * Manager mark-trained: creates a completed row, or finishes an open/retrain
 * assignment (so Require retrain → Mark trained works without blocking).
 */
export function applyManagerMarkTrained(input: {
  item: TrainingItem;
  trainee: { id: string; name: string };
  actor: { id: string; name: string };
  nowIso: string;
  existing: TrainingAssignment | null;
}): TrainingAssignment {
  if (input.existing?.status === 'completed') {
    throw new Error('This step is already marked trained.');
  }
  const event = {
    id: newEventId(),
    type: 'marked_trained' as const,
    at: input.nowIso,
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: 'Manager marked already trained',
  };
  if (input.existing) {
    const next = appendTrainingEvent(input.existing, event);
    return { ...next, status: 'completed', missStreak: 0, dueAt: null };
  }
  return buildMarkedTrainedAssignment(input);
}

export function reorderTrainingItems(items: TrainingItem[], fromIndex: number, toIndex: number): TrainingItem[] {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  const now = new Date().toISOString();
  return next.map((item, index) => ({ ...item, order: index + 1, updatedAt: now }));
}

/** Persist order after a dashboard-style drag (ordered ids from grid layout). */
export function reorderTrainingItemsByIds(items: TrainingItem[], orderedIds: string[]): TrainingItem[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const now = new Date().toISOString();
  const next: TrainingItem[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (!item) continue;
    next.push(item);
    byId.delete(id);
  }
  Array.from(byId.values()).forEach(leftover => next.push(leftover));
  return next.map((item, index) => ({ ...item, order: index + 1, updatedAt: now }));
}

export function removeTrainingItem(items: TrainingItem[], itemId: string): TrainingItem[] {
  const now = new Date().toISOString();
  return items
    .filter(i => i.id !== itemId)
    .map((item, index) => ({ ...item, order: index + 1, updatedAt: now }));
}
