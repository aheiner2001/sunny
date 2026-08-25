type InspectionQuestion = {
  id: string;
  required?: boolean;
};

type InspectionResponse = {
  value?: string | null;
  isFlagged?: boolean;
  notes?: string;
};

export function canSubmitInspection(
  questions: InspectionQuestion[],
  responses: Record<string, InspectionResponse>,
): boolean {
  return questions
    .filter(question => question.required)
    .every(question => {
      const value = responses[question.id]?.value;
      return value !== undefined && value !== null && value !== '';
    });
}
