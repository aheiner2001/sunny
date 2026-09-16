import type { ChecklistQuestion } from '@/types';

/** Drop expired temporary questions from inspect/return checklists. */
export function activeChecklistQuestions(
  questions: ChecklistQuestion[],
  today = new Date()
): ChecklistQuestion[] {
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return questions.filter((q) => {
    if (!q.isTemporary) return true;
    if (!q.expiresAt) return true;
    return q.expiresAt >= todayStr;
  });
}
