import { expect, it } from 'vitest';
import { toLocalAssignmentTime } from '../assignmentTime';

it('preserves seconds when defaulting a manager assignment to now', () => {
  const date = new Date('2026-09-23T10:15:45.000Z');
  expect(new Date(toLocalAssignmentTime(date)).getTime()).toBe(date.getTime());
  expect(toLocalAssignmentTime(date)).toMatch(/:45$/);
});
