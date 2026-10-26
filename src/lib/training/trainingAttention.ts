import type { TrainingAssignment, TraineeTrainerLink } from './types';

export type TrainingAttentionBucket = 'awaiting_trainer' | 'awaiting_employee' | 'needs_retrain';

export type TrainingAttentionRow = {
  bucket: TrainingAttentionBucket;
  assignment: TrainingAssignment;
};

const BUCKET_ORDER: Record<TrainingAttentionBucket, number> = {
  needs_retrain: 0,
  awaiting_trainer: 1,
  awaiting_employee: 2,
};

export function buildTrainingAttentionRows(
  assignments: TrainingAssignment[],
): TrainingAttentionRow[] {
  const out: TrainingAttentionRow[] = [];
  for (const assignment of assignments) {
    if (assignment.status === 'needs_retrain') {
      out.push({ bucket: 'needs_retrain', assignment });
    } else if (assignment.status === 'assigned' || assignment.status === 'overdue') {
      out.push({ bucket: 'awaiting_trainer', assignment });
    } else if (assignment.status === 'awaiting_trainee') {
      out.push({ bucket: 'awaiting_employee', assignment });
    }
  }
  const awaitingTrainerStatusRank = (status: TrainingAssignment['status']) =>
    status === 'overdue' ? 0 : status === 'assigned' ? 1 : 2;

  return out.sort(
    (a, b) =>
      BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
      a.assignment.traineeName.localeCompare(b.assignment.traineeName) ||
      awaitingTrainerStatusRank(a.assignment.status) -
        awaitingTrainerStatusRank(b.assignment.status),
  );
}

export function buildTrainerSignOffQueue(input: {
  assignments: TrainingAssignment[];
  trainerId: string;
  links: Pick<TraineeTrainerLink, 'traineeId' | 'trainerIds'>[];
}): TrainingAssignment[] {
  const paired = new Set(
    input.links.filter(l => l.trainerIds.includes(input.trainerId)).map(l => l.traineeId),
  );
  return input.assignments.filter(
    a =>
      paired.has(a.traineeId) &&
      (a.status === 'assigned' || a.status === 'overdue'),
  );
}
