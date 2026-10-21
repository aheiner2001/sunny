import { describe, expect, it } from 'vitest';
import { shiftsToCsv } from '../timesheetExport';
import type { ShiftRecord } from '../types';

const shift = (overrides: Partial<ShiftRecord> = {}): ShiftRecord => ({
  id: 'shift-1',
  employeeId: 'emp-1',
  employeeName: 'Alice',
  locationId: 'loc-main',
  status: 'pending',
  timeZone: 'America/Denver',
  startAtUtc: '2026-10-14T14:00:00.000Z',
  endAtUtc: '2026-10-14T20:00:00.000Z',
  unpaidBreakSeconds: 1800,
  startSource: 'manual',
  endSource: 'manual',
  startEventId: 'evt-1',
  endEventId: 'evt-2',
  revision: 2,
  createdAt: '2026-10-14T14:00:00.000Z',
  updatedAt: '2026-10-14T20:00:00.000Z',
  submittedAt: '2026-10-14T20:00:00.000Z',
  approvedAt: null,
  approvedBy: null,
  ...overrides,
});

describe('shiftsToCsv', () => {
  it('includes a header and one row with escaped fields', () => {
    const csv = shiftsToCsv([shift({ employeeName: 'Alice "A"', unpaidBreakSeconds: 1800 })]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('Employee');
    expect(lines[0]).toContain('Net Hours');
    expect(lines[1]).toContain('Alice ""A""');
    expect(lines[1]).toContain('30');
    expect(lines[1]).toContain('5.50');
    expect(lines[1]).toContain('pending');
  });

  it('marks open shifts without inventing an end time', () => {
    const csv = shiftsToCsv([shift({ status: 'active', endAtUtc: null, endSource: null, endEventId: null })]);
    expect(csv).toContain('In Progress');
    expect(csv.split('\n')[1]).not.toMatch(/20:00/);
  });
});
