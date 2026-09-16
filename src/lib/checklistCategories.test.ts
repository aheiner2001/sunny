import { describe, expect, it } from 'vitest';
import {
  mintCategoryId,
  repairDuplicateCategoryIds,
  planDeleteCategory,
} from './checklistCategories';
import type { ChecklistCategoryConfig, ChecklistQuestion } from '@/types';

const cat = (over: Partial<ChecklistCategoryConfig> = {}): ChecklistCategoryConfig => ({
  id: 'equipment',
  title: 'Equipment',
  subtitle: '',
  order: 1,
  iconName: 'Wrench',
  ...over,
});

const q = (over: Partial<ChecklistQuestion> = {}): ChecklistQuestion => ({
  id: 'q1',
  category: 'equipment',
  text: 'Check tool',
  type: 'checkbox',
  required: true,
  order: 1,
  ...over,
});

describe('mintCategoryId', () => {
  it('returns a stable unique-looking id not derived from a title', () => {
    const a = mintCategoryId(1000);
    const b = mintCategoryId(1001);
    expect(a).toMatch(/^cat-/);
    expect(a).not.toBe(b);
    expect(a.includes('vehicle')).toBe(false);
  });
});

describe('repairDuplicateCategoryIds', () => {
  it('keeps the first id and remints duplicates', () => {
    const { categories, changed } = repairDuplicateCategoryIds([
      cat({ id: 'vehicle_condition', title: 'Vehicle Condition', order: 1 }),
      cat({ id: 'vehicle_condition', title: 'Vehicle Condition Copy', order: 2 }),
    ]);
    expect(changed).toBe(true);
    expect(categories[0].id).toBe('vehicle_condition');
    expect(categories[1].id).not.toBe('vehicle_condition');
    expect(categories[1].id).toMatch(/^cat-/);
  });

  it('is a no-op when ids are unique', () => {
    const { changed } = repairDuplicateCategoryIds([
      cat({ id: 'equipment' }),
      cat({ id: 'supplies', title: 'Supplies', order: 2 }),
    ]);
    expect(changed).toBe(false);
  });
});

describe('planDeleteCategory', () => {
  it('moves questions then removes the category', () => {
    const categories = [
      cat({ id: 'equipment' }),
      cat({ id: 'supplies', title: 'Supplies', order: 2 }),
    ];
    const questions = [q({ category: 'equipment' }), q({ id: 'q2', category: 'supplies' })];
    const next = planDeleteCategory({
      categories,
      questions,
      catId: 'equipment',
      mode: 'move',
      moveToCategoryId: 'supplies',
    });
    expect(next.categories.map(c => c.id)).toEqual(['supplies']);
    expect(next.questions.every(x => x.category === 'supplies')).toBe(true);
    expect(next.questions).toHaveLength(2);
  });

  it('deletes questions in that category', () => {
    const next = planDeleteCategory({
      categories: [cat({ id: 'equipment' }), cat({ id: 'supplies', title: 'Supplies', order: 2 })],
      questions: [q({ category: 'equipment' }), q({ id: 'q2', category: 'supplies' })],
      catId: 'equipment',
      mode: 'delete_questions',
    });
    expect(next.categories.map(c => c.id)).toEqual(['supplies']);
    expect(next.questions).toHaveLength(1);
    expect(next.questions[0].category).toBe('supplies');
  });

  it('throws when moving without a destination or into the deleted id', () => {
    expect(() =>
      planDeleteCategory({
        categories: [cat(), cat({ id: 'supplies', title: 'Supplies', order: 2 })],
        questions: [q()],
        catId: 'equipment',
        mode: 'move',
      })
    ).toThrow();
  });
});
