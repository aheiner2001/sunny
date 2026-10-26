import { describe, expect, it } from 'vitest';
import {
  applyPreviousUserQuestionSettings,
  canHoldPreviousUserAccountable,
  togglePreviousUserAccountable,
} from '../previousUserQuestionSettings';
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

  it('only allows previous-user mark on yes/no and pass/fail questions', () => {
    expect(canHoldPreviousUserAccountable('yes_no')).toBe(true);
    expect(canHoldPreviousUserAccountable('pass_fail')).toBe(true);
    expect(canHoldPreviousUserAccountable('photo')).toBe(false);
  });

  it('quick-toggles previous-user accountability while keeping the message', () => {
    const on = togglePreviousUserAccountable({
      ...base,
      holdPreviousUserAccountable: false,
      previousUserMessage: 'Clean cab',
    });
    expect(on).toMatchObject({ holdPreviousUserAccountable: true, previousUserMessage: 'Clean cab' });
    const off = togglePreviousUserAccountable(on!);
    expect(off).toMatchObject({ holdPreviousUserAccountable: false, previousUserMessage: undefined });
    expect(togglePreviousUserAccountable({ ...base, type: 'photo' })).toBeNull();
  });

  it('seeds a default measures message when turning previous-user on with none set', () => {
    expect(togglePreviousUserAccountable(base)).toMatchObject({
      holdPreviousUserAccountable: true,
      previousUserMessage: 'Please address this before your next truck scan.',
    });
  });
});
