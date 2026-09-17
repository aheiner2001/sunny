/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { canSubmitInspection, getUnansweredInspectionQuestions } from './inspectionValidation';

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

  it('requires a photoUrl for required photo questions', () => {
    const photoQuestions = [{ id: 'tire-photo', required: true, type: 'photo' }];
    expect(canSubmitInspection(photoQuestions, {})).toBe(false);
    expect(canSubmitInspection(photoQuestions, {
      'tire-photo': { value: 'captured', isFlagged: false },
    })).toBe(false);
    expect(canSubmitInspection(photoQuestions, {
      'tire-photo': { value: 'captured', isFlagged: false, photoUrl: 'data:image/jpeg;base64,abc' },
    })).toBe(true);
  });

  it('optional photoRequirement allows submit without a photo', () => {
    const qs = [{ id: 'y1', required: true, type: 'yes_no', photoRequirement: 'optional' as const }];
    expect(canSubmitInspection(qs, { y1: { value: 'yes' } })).toBe(true);
  });

  it('required photoRequirement enforces a photo even when value is set', () => {
    const qs = [{ id: 'y1', required: true, type: 'yes_no', photoRequirement: 'required' as const }];
    expect(canSubmitInspection(qs, { y1: { value: 'no' } })).toBe(false);
    expect(canSubmitInspection(qs, { y1: { value: 'no', photoUrl: 'data:image/jpeg;base64,x' } })).toBe(true);
  });

  it('requires checkbox questions to be checked', () => {
    expect(
      canSubmitInspection(
        [{ id: 'c1', required: true, type: 'checkbox' }],
        { c1: { value: '' } }
      )
    ).toBe(false);
    expect(
      canSubmitInspection(
        [{ id: 'c1', required: true, type: 'checkbox' }],
        { c1: { value: 'checked' } }
      )
    ).toBe(true);
  });

  it('requires equipment_check answers', () => {
    expect(
      canSubmitInspection(
        [{ id: 'e1', required: true, type: 'equipment_check' }],
        {}
      )
    ).toBe(false);
    expect(
      canSubmitInspection(
        [{ id: 'e1', required: true, type: 'equipment_check' }],
        { e1: { value: 'working' } }
      )
    ).toBe(true);
  });

  it('lists unanswered questions for Take me to unanswered', () => {
    const unanswered = getUnansweredInspectionQuestions(
      [
        { id: 'a', required: true, type: 'yes_no', text: 'Lights ok?' },
        { id: 'b', required: true, type: 'checkbox', text: 'Seatbelt?' },
      ],
      { a: { value: 'yes' } }
    );
    expect(unanswered.map(q => q.id)).toEqual(['b']);
  });
});
