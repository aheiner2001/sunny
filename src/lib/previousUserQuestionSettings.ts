import type { ChecklistQuestion } from '@/types';

export function applyPreviousUserQuestionSettings(
  question: ChecklistQuestion,
  input: { holdPreviousUserAccountable: boolean; previousUserMessage: string },
): ChecklistQuestion {
  if (!input.holdPreviousUserAccountable) {
    return {
      ...question,
      holdPreviousUserAccountable: false,
      previousUserMessage: undefined,
    };
  }
  const message = input.previousUserMessage.trim();
  return {
    ...question,
    holdPreviousUserAccountable: true,
    previousUserMessage: message || undefined,
  };
}
