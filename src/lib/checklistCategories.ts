import type { ChecklistCategoryConfig, ChecklistQuestion } from '@/types';

export function mintCategoryId(now = Date.now()): string {
  return `cat-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

export function repairDuplicateCategoryIds(
  categories: ChecklistCategoryConfig[]
): { categories: ChecklistCategoryConfig[]; changed: boolean } {
  const seen = new Set<string>();
  let changed = false;
  const next = categories.map((c) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      return c;
    }
    changed = true;
    let id = mintCategoryId();
    while (seen.has(id)) id = mintCategoryId();
    seen.add(id);
    return { ...c, id };
  });
  return { categories: next, changed };
}

export function planDeleteCategory(args: {
  categories: ChecklistCategoryConfig[];
  questions: ChecklistQuestion[];
  catId: string;
  mode: 'move' | 'delete_questions';
  moveToCategoryId?: string;
}): { categories: ChecklistCategoryConfig[]; questions: ChecklistQuestion[] } {
  const { categories, questions, catId, mode, moveToCategoryId } = args;
  if (categories.length <= 1) {
    throw new Error('Cannot delete the last category');
  }
  if (!categories.some((c) => c.id === catId)) {
    throw new Error('Category not found');
  }
  let nextQuestions = questions;
  if (mode === 'move') {
    if (!moveToCategoryId || moveToCategoryId === catId) {
      throw new Error('Pick another category to move questions into');
    }
    if (!categories.some((c) => c.id === moveToCategoryId)) {
      throw new Error('Destination category not found');
    }
    nextQuestions = questions.map((q) =>
      q.category === catId ? { ...q, category: moveToCategoryId } : q
    );
  } else {
    nextQuestions = questions.filter((q) => q.category !== catId);
  }
  return {
    categories: categories.filter((c) => c.id !== catId),
    questions: nextQuestions,
  };
}
