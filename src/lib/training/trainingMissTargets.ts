import type { ChecklistQuestion, Inspection, InspectionAlert, VehicleAssignment } from '@/types';
import { findPreviousVehicleUser } from '../previousVehicleUser';
import type { TrainingAssignment, TrainingItem } from './types';

export type TrainingMissTarget = {
  itemId: string;
  traineeId: string;
  questionIds: string[];
  reason: 'previous_user' | 'submitter';
};

/**
 * When a linked inspection question is flagged:
 * - If the question holds the previous user accountable → tick that previous user's training
 * - Otherwise → tick the inspector (submitter)
 * Only returns targets that already have a training assignment for the item.
 */
export function resolveTrainingMissTargets(input: {
  items: TrainingItem[];
  assignments: TrainingAssignment[];
  questions: ChecklistQuestion[];
  inspection: Inspection;
  alert: Pick<InspectionAlert, 'inspectionId' | 'vehicleId' | 'inspectionKind' | 'reportedById' | 'reportedAt'>;
  assignmentsHistory: VehicleAssignment[];
  inspectionsHistory?: Inspection[];
  submitterId: string;
}): TrainingMissTarget[] {
  const flagged = (input.inspection.responses || []).filter(r => r.isFlagged);
  if (!flagged.length) return [];

  const questionById = new Map(input.questions.map(q => [q.id, q]));
  const previous = findPreviousVehicleUser(
    input.alert as InspectionAlert,
    input.inspection,
    input.assignmentsHistory,
    input.inspectionsHistory || [],
  );

  const byTraineeItem = new Map<string, TrainingMissTarget>();

  for (const item of input.items.filter(i => i.active)) {
    for (const response of flagged) {
      if (!item.linkedQuestionIds.includes(response.questionId)) continue;
      const question = questionById.get(response.questionId);
      const usePrevious = Boolean(question?.holdPreviousUserAccountable && previous?.userId);
      const traineeId = usePrevious ? previous!.userId : input.submitterId;
      if (!traineeId) continue;

      const hasAssignment = input.assignments.some(
        a => a.traineeId === traineeId && a.itemId === item.id,
      );
      if (!hasAssignment) continue;

      const key = `${traineeId}::${item.id}`;
      const existing = byTraineeItem.get(key);
      if (existing) {
        if (!existing.questionIds.includes(response.questionId)) {
          existing.questionIds.push(response.questionId);
        }
      } else {
        byTraineeItem.set(key, {
          itemId: item.id,
          traineeId,
          questionIds: [response.questionId],
          reason: usePrevious ? 'previous_user' : 'submitter',
        });
      }
    }
  }

  return Array.from(byTraineeItem.values());
}

export function toggleLinkedQuestionId(item: TrainingItem, questionId: string, nowIso: string): TrainingItem {
  const set = new Set(item.linkedQuestionIds);
  if (set.has(questionId)) set.delete(questionId);
  else set.add(questionId);
  return {
    ...item,
    linkedQuestionIds: Array.from(set),
    updatedAt: nowIso,
  };
}

/** Visual strike slots for managers (filled = miss ticks toward retrain threshold). */
export function buildMissStrikeSlots(missStreak: number, retrainThreshold: number): {
  filled: number;
  total: number;
  atThreshold: boolean;
} {
  const total = Math.max(1, Math.min(20, Math.round(retrainThreshold) || 1));
  const filled = Math.max(0, Math.min(total, Math.round(missStreak) || 0));
  return { filled, total, atThreshold: filled >= total };
}
