import { describe, expect, it } from 'vitest';
import { canSubmitInspection } from './inspectionValidation';

const questions = [
  { id: 'required-one', required: true },
  { id: 'optional-one', required: false },
  { id: 'required-two', required: true },
];

describe('canSubmitInspection', () => {
  it('stays disabled until every required question has an answer', () => {
    expect(canSubmitInspection(questions, {})).toBe(false);
    expect(canSubmitInspection(questions, {
      'required-one': { value: 'pass', isFlagged: false },
    })).toBe(false);
    expect(canSubmitInspection(questions, {
      'required-one': { value: 'pass', isFlagged: false },
      'required-two': { value: 'yes', isFlagged: false },
    })).toBe(true);
  });
});
