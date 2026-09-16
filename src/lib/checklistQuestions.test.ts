import { describe, expect, it } from 'vitest';
import { activeChecklistQuestions } from './checklistQuestions';
import type { ChecklistQuestion } from '@/types';

const base = {
  category: 'general',
  type: 'yes_no' as const,
  required: true,
  order: 1,
};

describe('activeChecklistQuestions', () => {
  it('keeps permanent and unexpired temporary questions', () => {
    const qs: ChecklistQuestion[] = [
      { ...base, id: '1', text: 'Always' },
      { ...base, id: '2', text: 'Temp', isTemporary: true, expiresAt: '2099-01-01' },
      { ...base, id: '3', text: 'Expired', isTemporary: true, expiresAt: '2020-01-01' },
    ];
    const active = activeChecklistQuestions(qs, new Date('2026-09-16'));
    expect(active.map((q) => q.id)).toEqual(['1', '2']);
  });
});
