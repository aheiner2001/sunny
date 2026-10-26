import type {
  ChecklistQuestion,
  Inspection,
  InspectionAlert,
  PreviousUserFlag,
  VehicleAssignment,
} from '@/types';
import { findPreviousVehicleUser } from './previousVehicleUser';

export function buildPreviousUserAccountabilityFlags(input: {
  inspection: Inspection;
  alert: Pick<InspectionAlert, 'inspectionId' | 'vehicleId' | 'inspectionKind' | 'reportedById' | 'reportedAt'>;
  questions: ChecklistQuestion[];
  assignments: VehicleAssignment[];
  inspections?: Inspection[];
  now?: string;
}): Omit<PreviousUserFlag, 'id'>[] {
  const { inspection, alert, questions, assignments, inspections = [], now } = input;
  const previous = findPreviousVehicleUser(
    alert as InspectionAlert,
    inspection,
    assignments,
    inspections,
  );
  if (!previous) return [];

  const createdAt = now || inspection.submittedAt || new Date().toISOString();
  const byId = new Map(questions.map(q => [q.id, q]));
  const out: Omit<PreviousUserFlag, 'id'>[] = [];

  for (const response of inspection.responses || []) {
    const question = byId.get(response.questionId);
    if (!question?.holdPreviousUserAccountable) continue;
    if (!response.isFlagged) continue;

    out.push({
      employeeId: previous.userId,
      employeeName: previous.userName,
      vehicleId: inspection.vehicleId,
      vehicleNumber: inspection.vehicleNumber,
      questionId: response.questionId,
      questionText: response.questionText || question.text,
      inspectionId: inspection.id,
      message: (question.previousUserMessage || '').trim(),
      status: 'open',
      createdAt,
      createdById: inspection.userId,
      acknowledgedAt: null,
    });
  }

  return out;
}
