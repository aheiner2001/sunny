export type TrainingDeadlineType = 'end_of_day' | 'within_days';

export type TrainingAssignmentStatus =
  | 'assigned'
  | 'awaiting_trainee'
  | 'completed'
  | 'overdue'
  | 'needs_retrain';

export type TrainingEventType =
  | 'trainer_signoff'
  | 'trainee_certify'
  | 'miss'
  | 'retrain_required'
  | 'deadline_passed'
  | 'assigned';

export interface TrainingItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  active: boolean;
  deadlineType: TrainingDeadlineType;
  withinDays?: number;
  retrainThreshold: number;
  linkedQuestionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TraineeTrainerLink {
  traineeId: string;
  trainerIds: string[];
  updatedAt: string;
}

export interface TrainingEvent {
  id: string;
  type: TrainingEventType;
  at: string;
  actorId: string;
  actorName: string;
  note?: string;
}

export interface TrainingAssignment {
  id: string;
  traineeId: string;
  traineeName: string;
  itemId: string;
  status: TrainingAssignmentStatus;
  dueAt: string | null;
  missStreak: number;
  events: TrainingEvent[];
  createdAt: string;
  updatedAt: string;
}
