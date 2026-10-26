import { describe, expect, it } from 'vitest';
import { applyPreviousUserQuestionSettings } from '../previousUserQuestionSettings';
import type { ChecklistQuestion } from '@/types';

const base: ChecklistQuestion = {
  id: 'q1',
  category: 'interior',
  text: 'Is the cab clean?',
  type: 'yes_no',
  required: true,
  order: 1,
};

describe('applyPreviousUserQuestionSettings', () => {
  it('stores the accountability toggle and message on the question', () => {
    expect(
      applyPreviousUserQuestionSettings(base, {
        holdPreviousUserAccountable: true,
        previousUserMessage: ' Wipe down seats next time. ',
      }),
    ).toMatchObject({
      holdPreviousUserAccountable: true,
      previousUserMessage: 'Wipe down seats next time.',
    });
  });

  it('clears message when accountability is off', () => {
    expect(
      applyPreviousUserQuestionSettings(
        { ...base, holdPreviousUserAccountable: true, previousUserMessage: 'old' },
        { holdPreviousUserAccountable: false, previousUserMessage: 'ignore me' },
      ),
    ).toMatchObject({
      holdPreviousUserAccountable: false,
      previousUserMessage: undefined,
    });
  });
});
