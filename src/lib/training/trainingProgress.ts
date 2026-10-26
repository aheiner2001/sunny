import type { TrainingAssignment, TrainingAssignmentStatus, TrainingItem } from './types';

export type TraineeLearnRow = {
  traineeId: string;
  traineeName: string;
  totalSteps: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percentComplete: number;
  hasNeedsRetrain: boolean;
  /** Latest / most urgent status across their assignments */
  headlineStatus: 'trained' | 'in_progress' | 'needs_attention' | 'not_started';
};

const STATUS_RANK: Record<TrainingAssignmentStatus, number> = {
  completed: 5,
  awaiting_trainee: 4,
  assigned: 3,
  overdue: 2,
  needs_retrain: 1,
};

function bestStatusForItem(
  assignments: TrainingAssignment[],
  traineeId: string,
  itemId: string,
): TrainingAssignmentStatus | null {
  const rows = assignments.filter(a => a.traineeId === traineeId && a.itemId === itemId);
  if (!rows.length) return null;
  return rows.reduce((best, row) =>
    STATUS_RANK[row.status] > STATUS_RANK[best.status] ? row : best,
  ).status;
}

/**
 * One row per trainee: how much of the active curriculum they have completed.
 * Used by the Training “Learn” chart.
 */
export function buildTraineeLearnRows(input: {
  employees: Array<{ id: string; name: string }>;
  items: TrainingItem[];
  assignments: TrainingAssignment[];
}): TraineeLearnRow[] {
  const activeItems = input.items.filter(i => i.active).sort((a, b) => a.order - b.order);
  const totalSteps = activeItems.length;

  return input.employees
    .map(emp => {
      let completed = 0;
      let inProgress = 0;
      let notStarted = 0;
      let needsAttention = false;
      let hasNeedsRetrain = false;

      for (const item of activeItems) {
        const status = bestStatusForItem(input.assignments, emp.id, item.id);
        if (status === 'completed') completed += 1;
        else if (status === null) notStarted += 1;
        else {
          inProgress += 1;
          if (status === 'overdue' || status === 'needs_retrain') needsAttention = true;
          if (status === 'needs_retrain') hasNeedsRetrain = true;
        }
      }

      if (!totalSteps) {
        return {
          traineeId: emp.id,
          traineeName: emp.name,
          totalSteps: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          percentComplete: 0,
          hasNeedsRetrain: false,
          headlineStatus: 'not_started' as const,
        };
      }

      const percentComplete = Math.round((completed / totalSteps) * 100);
      let headlineStatus: TraineeLearnRow['headlineStatus'] = 'not_started';
      if (completed === totalSteps) headlineStatus = 'trained';
      else if (needsAttention) headlineStatus = 'needs_attention';
      else if (completed > 0 || inProgress > 0) headlineStatus = 'in_progress';

      return {
        traineeId: emp.id,
        traineeName: emp.name,
        totalSteps,
        completed,
        inProgress,
        notStarted,
        percentComplete,
        hasNeedsRetrain,
        headlineStatus,
      };
    })
    .sort((a, b) => b.percentComplete - a.percentComplete || a.traineeName.localeCompare(b.traineeName));
}

export function trainingStatusTone(
  status: TrainingAssignmentStatus,
): 'ok' | 'flagged' | 'critical' | 'info' | 'idle' {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'awaiting_trainee':
      return 'info';
    case 'assigned':
      return 'idle';
    case 'overdue':
      return 'flagged';
    case 'needs_retrain':
      return 'critical';
    default:
      return 'idle';
  }
}

export function trainingStatusLabel(status: TrainingAssignmentStatus): string {
  switch (status) {
    case 'completed':
      return 'Trained';
    case 'awaiting_trainee':
      return 'Awaiting certify';
    case 'assigned':
      return 'Assigned';
    case 'overdue':
      return 'Overdue';
    case 'needs_retrain':
      return 'Needs retrain';
    default:
      return status;
  }
}

/** Manager overview chip: Up to date | Needs training | Needs retrain */
export type EmployeeTrainingOverviewStatus = 'up_to_date' | 'needs_training' | 'needs_retrain';

export function employeeOverviewStatus(row: TraineeLearnRow): EmployeeTrainingOverviewStatus {
  if (row.hasNeedsRetrain) return 'needs_retrain';
  if (row.totalSteps === 0) return 'needs_training';
  if (row.headlineStatus === 'trained') return 'up_to_date';
  return 'needs_training';
}

export function employeeOverviewLabel(status: EmployeeTrainingOverviewStatus): string {
  switch (status) {
    case 'up_to_date':
      return 'Up to date';
    case 'needs_retrain':
      return 'Needs retrain';
    default:
      return 'Needs training';
  }
}

export function employeeOverviewTone(
  status: EmployeeTrainingOverviewStatus,
): 'ok' | 'flagged' | 'critical' | 'info' | 'idle' {
  switch (status) {
    case 'up_to_date':
      return 'ok';
    case 'needs_retrain':
      return 'critical';
    default:
      return 'flagged';
  }
}
