import {
  getUnansweredQuestions,
  isAnswerComplete,
  type PhotoRequirement,
} from '@/lib/checklistPairing';

type InspectionQuestion = {
  id: string;
  required?: boolean;
  type?: string;
  photoRequirement?: PhotoRequirement;
  text?: string;
};

type InspectionResponse = {
  value?: string | null;
  isFlagged?: boolean;
  notes?: string;
  photoUrl?: string;
};

export function canSubmitInspection(
  questions: InspectionQuestion[],
  responses: Record<string, InspectionResponse>,
): boolean {
  return questions
    .filter(question => question.required !== false)
    .every(question => isAnswerComplete(question, responses[question.id]));
}

export function getUnansweredInspectionQuestions(
  questions: InspectionQuestion[],
  responses: Record<string, InspectionResponse>,
): InspectionQuestion[] {
  return getUnansweredQuestions(questions, responses);
}
