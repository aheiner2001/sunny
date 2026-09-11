type InspectionQuestion = {
  id: string;
  required?: boolean;
  type?: string;
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
    .filter(question => question.required)
    .every(question => {
      const response = responses[question.id];
      if (question.type === 'photo') {
        return Boolean(response?.photoUrl);
      }
      const value = response?.value;
      return value !== undefined && value !== null && value !== '';
    });
}
