import type { TrainingAssignment, TrainingItem } from './types';
import { computeTrainingDueAt } from './trainingDomain';

export function formatTrainingActionError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
}

export function buildNewTrainingItem(
  title: string,
  order: number,
  nowIso: string,
): TrainingItem | { error: string } {
  const trimmed = title.trim();
  if (!trimmed) return { error: 'Enter a training step title before adding.' };
  return {
    id: `train-${Date.now()}`,
    title: trimmed,
    order,
    active: true,
    deadlineType: 'within_days',
    withinDays: 7,
    retrainThreshold: 2,
    linkedQuestionIds: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function buildTrainingAssignment(input: {
  item: TrainingItem;
  trainee: { id: string; name: string };
  actor: { id: string; name: string };
  nowIso: string;
}): TrainingAssignment {
  return {
    id: `asg-${Date.now()}`,
    traineeId: input.trainee.id,
    traineeName: input.trainee.name,
    itemId: input.item.id,
    status: 'assigned',
    dueAt: computeTrainingDueAt(input.item, input.nowIso),
    missStreak: 0,
    events: [
      {
        id: `tev-${Date.now()}`,
        type: 'assigned',
        at: input.nowIso,
        actorId: input.actor.id,
        actorName: input.actor.name,
      },
    ],
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  };
}

export function updateTrainingItemSettings(
  item: TrainingItem,
  patch: { withinDays?: number; retrainThreshold?: number },
  nowIso: string,
): TrainingItem {
  const withinDays =
    patch.withinDays !== undefined
      ? Math.max(1, Math.min(90, Math.round(patch.withinDays)))
      : item.withinDays;
  const retrainThreshold =
    patch.retrainThreshold !== undefined
      ? Math.max(1, Math.min(20, Math.round(patch.retrainThreshold)))
      : item.retrainThreshold;
  return {
    ...item,
    withinDays,
    retrainThreshold,
    updatedAt: nowIso,
  };
}

/** Managers see everyone; designated trainers prefer their paired trainees when links exist. */
export function traineesForAssigner(input: {
  employees: Array<{ id: string; name: string }>;
  links: Array<{ traineeId: string; trainerIds: string[] }>;
  assignerId: string;
  isManager: boolean;
}): Array<{ id: string; name: string }> {
  if (input.isManager) return input.employees;
  const paired = new Set(
    input.links.filter(l => l.trainerIds.includes(input.assignerId)).map(l => l.traineeId),
  );
  if (!paired.size) return input.employees;
  const filtered = input.employees.filter(e => paired.has(e.id));
  return filtered.length ? filtered : input.employees;
}
