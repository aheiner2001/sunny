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
  | 'retrain_approved'
  | 'manager_retrain'
  | 'deadline_passed'
  | 'assigned'
  | 'onboarded'
  | 'marked_trained';

export type TrainingCategory =
  | 'inspection'
  | 'safety'
  | 'chemicals'
  | 'equipment'
  | 'maintenance'
  | 'general';

export interface TrainingCard {
  id: string;
  title?: string;
  imageUrl?: string;
  imageCaption?: string;
  content: string;
  calloutType?: 'info' | 'warning' | 'tip';
  calloutText?: string;
}

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
  category?: TrainingCategory;
  coverImageUrl?: string;
  estimatedMinutes?: number;
  keyTakeaways?: string[];
  cards?: TrainingCard[];
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
