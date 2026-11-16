// prototype/fixtures.mjs

/**
 * Test user identities for local auth experiments.
 * In a real backend, these tokens would be cryptographic Firebase JWTs.
 */
export const TEST_USERS = [
  {
    token: 'token-manager-1',
    id: 'usr-morgan',
    name: 'Morgan Manager',
    role: 'manager',
  },
  {
    token: 'token-employee-1',
    id: 'usr-alex',
    name: 'Alex Employee',
    role: 'employee',
  },
];

/**
 * Fictional shift records for our local reporting prototype.

 * All timestamps are in ISO UTC format.
 * In November, America/Denver is UTC-7 (Mountain Standard Time).
 */
export const FIXTURE_SHIFTS = [
  {
    id: 'shift-1',
    employeeId: 'emp-101',
    employeeName: 'Sarah Connor',
    status: 'approved',
    // Monday Nov 2, 2026: 09:00 to 10:45 AM Denver time (UTC-7)
    // 09:00 + 7 hours = 16:00 UTC.
    // Duration: 1 hour 45 minutes = 1.75 hours (6,300 seconds).
    startAtUtc: '2026-11-02T16:00:00.000Z',
    endAtUtc: '2026-11-02T17:45:00.000Z',
    unpaidBreakSeconds: 0,
  },
  {
    id: 'shift-2',
    employeeId: 'emp-102',
    employeeName: 'John Smith',
    status: 'pending',
    // Tuesday Nov 3, 2026: 1:00 PM to 3:00 PM Denver time (UTC-7)
    // 13:00 + 7 hours = 20:00 UTC.
    // Duration: 2 hours 0 minutes = 2.00 hours (7,200 seconds).
    startAtUtc: '2026-11-03T20:00:00.000Z',
    endAtUtc: '2026-11-03T22:00:00.000Z',
    unpaidBreakSeconds: 0,
  },
  {
    id: 'shift-3-outside',
    employeeId: 'emp-101',
    employeeName: 'Sarah Connor',
    status: 'approved',
    // Wednesday Oct 28, 2026 (Previous week):
    // Should NOT be counted in the Nov 2 - Nov 8 reporting week!
    startAtUtc: '2026-10-28T16:00:00.000Z',
    endAtUtc: '2026-10-28T18:00:00.000Z',
    unpaidBreakSeconds: 0,
  },
  {
    id: 'shift-4-boundary',
    employeeId: 'emp-103',
    employeeName: 'Kyle Reese',
    status: 'approved',
    // Sunday Nov 1, 2026 at 11:50 PM Denver time (ends at 11:59:59 PM)
    // This is right before midnight at the boundary of the previous week.
    // Should NOT be counted in the Nov 2 week!
    startAtUtc: '2026-11-02T06:50:00.000Z',
    endAtUtc: '2026-11-02T06:59:59.000Z',
    unpaidBreakSeconds: 0,
  }
];

/**
 * Fictional training assignments for testing GET /training/gaps.
 * 1 completed (excluded), 1 incomplete (included), 1 retrain required (included).
 */
export const FIXTURE_TRAINING_ASSIGNMENTS = [
  {
    id: 'asg-1',
    traineeId: 'emp-102',
    traineeName: 'John Smith',
    itemId: 'item-wash-1',
    itemTitle: 'Commercial Pressure Washer Operation',
    status: 'completed', // COMPLETED -> Must be EXCLUDED from gaps
    dueAt: '2026-11-01T00:00:00.000Z',
    missStreak: 0,
  },
  {
    id: 'asg-2',
    traineeId: 'emp-104',
    traineeName: 'Alex Rivera',
    itemId: 'item-chem-2',
    itemTitle: 'Chemical Dilution & PPE Safety',
    status: 'awaiting_trainee', // INCOMPLETE (Trainer signed off, awaiting employee) -> INCLUDED
    dueAt: '2026-11-06T00:00:00.000Z',
    missStreak: 0,
  },
  {
    id: 'asg-3',
    traineeId: 'emp-101',
    traineeName: 'Sarah Connor',
    itemId: 'item-ladder-3',
    itemTitle: 'Van Ladder Rack Securement',
    status: 'needs_retrain', // RETRAINING REQUIRED (Inspection misses triggered retrain) -> INCLUDED
    dueAt: '2026-11-04T00:00:00.000Z',
    missStreak: 3,
  },
];

