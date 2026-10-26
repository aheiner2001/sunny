import type { ChecklistQuestion, QuestionType } from '@/types';

/** Pass/fail and yes/no answers can flag the prior driver. */
export function canHoldPreviousUserAccountable(type: QuestionType): boolean {
  return type === 'yes_no' || type === 'pass_fail';
}

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

export const DEFAULT_PREVIOUS_USER_MESSAGE =
  'Please address this before your next truck scan.';

/** One-click Settings row toggle; keeps any existing measures message when turning on. */
export function togglePreviousUserAccountable(question: ChecklistQuestion): ChecklistQuestion | null {
  if (!canHoldPreviousUserAccountable(question.type)) return null;
  const nextOn = !question.holdPreviousUserAccountable;
  return applyPreviousUserQuestionSettings(question, {
    holdPreviousUserAccountable: nextOn,
    previousUserMessage:
      question.previousUserMessage?.trim() || (nextOn ? DEFAULT_PREVIOUS_USER_MESSAGE : ''),
  });
}
