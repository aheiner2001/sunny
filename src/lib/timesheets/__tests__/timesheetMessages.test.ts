import { describe, expect, it } from 'vitest';
import { humanizeTimesheetError } from '../timesheetMessages';

describe('humanizeTimesheetError', () => {
  it('explains missing auth for clock actions', () => {
    expect(humanizeTimesheetError(new Error('Firebase authentication unavailable. Please retry.'), 'clock in')).toMatch(
      /signed in|sign in|retry/i,
    );
  });

  it('explains permission failures without raw Firebase codes', () => {
    const message = humanizeTimesheetError(
      { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
      'clock in',
    );
    expect(message).toMatch(/permission/i);
    expect(message).not.toContain('permission-denied');
  });

  it('explains NO_ACTIVE_SHIFT for clock out', () => {
    expect(humanizeTimesheetError(new Error('NO_ACTIVE_SHIFT'), 'clock out')).toMatch(/no active shift/i);
  });
});
