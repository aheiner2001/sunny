import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { dbService } from '@/lib/db';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';
import * as historicalRecoveryService from '@/lib/timesheets/historicalRecoveryService';
import HistoricalHoursRecovery from '../HistoricalHoursRecovery';
import type { Inspection } from '@/types';
vi.mock('@/lib/firebase', () => ({ db: null, ensureAuth: vi.fn() }));
const evidence = [
  { id: 'morning', kind: 'pretrip', userId: 'max', userName: 'Max', vehicleId: 'van', vehicleNumber: '101', status: 'passed', submittedAt: '2026-10-19T13:37:00Z' },
  { id: 'returned', kind: 'return', userId: 'max', userName: 'Max', vehicleId: 'van', vehicleNumber: '101', status: 'passed', submittedAt: '2026-10-19T21:15:00Z' },
] as Inspection[];
const preview = () => {
  render(<HistoricalHoursRecovery actor={{ id: 'manager', name: 'Manager' }} weekStartUtc="2026-10-19T06:00:00Z" weekEndUtc="2026-10-26T05:59:59Z" />);
  fireEvent.click(screen.getByRole('button', { name: 'Recover historical hours' }));
};
beforeEach(() => { timesheetStore.reset(); vi.spyOn(dbService, 'getInspections').mockReturnValue(evidence); });
afterEach(() => { cleanup(); timesheetStore.reset(); vi.restoreAllMocks(); });
it('previews the evidence without inserting hours', async () => {
  preview();
  await screen.findByText('7h 38m');
  expect(screen.getByText(/inspection submitted/)).toBeDefined();
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
});
it('adds an estimate only as pending, with source IDs and no active shift guard', async () => {
  preview();
  fireEvent.click(await screen.findByRole('button', { name: /add.*for review/i }));
  await waitFor(() => expect(timesheetStore.getAllShifts()).toHaveLength(1));
  expect(timesheetStore.getAllShifts()[0]).toMatchObject({ status: 'pending', approvedBy: null,
    recovery: { inspectionId: 'morning', returnInspectionId: 'returned' } });
  expect(timesheetStore.getActiveShiftGuard('max')).toBeNull();
  expect(screen.queryByRole('button', { name: /add.*for review/i })).toBeNull();
});
it('flags incomplete history and offers no automatic import', async () => {
  vi.mocked(dbService.getInspections).mockReturnValue([evidence[0]]);
  preview();
  await screen.findByText(/no return submitted.*enter an end time/i);
  expect(screen.queryByRole('button', { name: /add.*for review/i })).toBeNull();
});
it('lets a manager set an end time on a missing-return row and save for review', async () => {
  vi.mocked(dbService.getInspections).mockReturnValue([evidence[0]]);
  const recover = vi.spyOn(historicalRecoveryService, 'recoverHistoricalEstimateWithManualEnd');
  preview();

  fireEvent.change(await screen.findByLabelText('End time for Max'), {
    target: { value: '2026-10-19T17:30' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add with end time' }));

  await waitFor(() => expect(recover).toHaveBeenCalledWith(
    'morning',
    '2026-10-19T23:30:00.000Z',
    { id: 'manager', name: 'Manager' },
  ));
  expect(screen.getByRole('status').textContent).toMatch(/added max.*pending/i);
});

it('hides manual-end controls when multiple pretrips make the day ambiguous', async () => {
  vi.mocked(dbService.getInspections).mockReturnValue([
    evidence[0],
    { ...evidence[0], id: 'afternoon', submittedAt: '2026-10-19T17:00:00Z' },
  ]);
  preview();

  await screen.findByText(/multiple inspections or returns/i);
  expect(screen.queryByLabelText('End time for Max')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add with end time' })).toBeNull();
});
