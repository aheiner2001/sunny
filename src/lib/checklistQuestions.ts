import type { ChecklistQuestion } from '@/types';

/** Normalize to MM-DD. Accepts MM-DD or YYYY-MM-DD. */
export function toMonthDay(value: string, today = new Date()): string {
  const v = value.trim();
  if (/^\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(5);
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

/** Inclusive yearly window; wraps across New Year when start > end. */
export function isDateInSeason(seasonStart: string, seasonEnd: string, today = new Date()): boolean {
  const start = toMonthDay(seasonStart, today);
  const end = toMonthDay(seasonEnd, today);
  const md = toMonthDay(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    today
  );
  if (start <= end) {
    return md >= start && md <= end;
  }
  // Wrap: e.g. 12-01 .. 02-28
  return md >= start || md <= end;
}

/** Drop inactive temporary/seasonal questions from inspect/return checklists. */
export function activeChecklistQuestions(
  questions: ChecklistQuestion[],
  today = new Date()
): ChecklistQuestion[] {
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return questions.filter((q) => {
    if (q.isSeasonal) {
      if (q.forcePaused) return false;
      if (q.forceActive) return true;
      if (!q.seasonStart || !q.seasonEnd) return false;
      return isDateInSeason(q.seasonStart, q.seasonEnd, today);
    }
    if (!q.isTemporary) return true;
    if (!q.expiresAt) return true;
    return q.expiresAt >= todayStr;
  });
}
