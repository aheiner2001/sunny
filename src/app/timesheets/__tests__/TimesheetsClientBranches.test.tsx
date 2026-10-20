import { beforeAll, afterAll } from 'vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TimesheetsClient from '../TimesheetsClient';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';

let mockAuthUser: any = {
  id: 'u-1',
  name: 'Trainee Tom',
  email: 'tom@sunny.com',
  role: 'employee',
};
let mockAuthRole = 'employee';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    role: mockAuthRole,
    isAuthenticated: true,
  }),
}));

describe('TimesheetsClient Branch & Edge Case Coverage', () => {
  beforeEach(() => {
    timesheetStore.reset();
    mockAuthUser = { id: 'u-1', name: 'Trainee Tom', email: 'tom@sunny.com', role: 'employee' };
    mockAuthRole = 'employee';
  });

  it('renders correctly when user is unauthenticated or null', () => {
    mockAuthUser = null;
    mockAuthRole = 'employee';
    render(<TimesheetsClient />);
    expect(screen.getByText(/local only — cloud sync unavailable/i)).toBeDefined();
    expect(screen.getAllByText(/0.00 hrs/i).length).toBeGreaterThan(0);
  });

  it('handles user with empty name, falling back to email or Employee', async () => {
    mockAuthUser = { id: 'u-anon', name: '', email: 'driver@sunny.com', role: 'employee' };
    render(<TimesheetsClient />);
    const clockInBtn = screen.getByRole('button', { name: /clock in/i });
    fireEvent.click(clockInBtn);

    await waitFor(() => {
      const shift = timesheetStore.getAllShifts().find((s) => s.employeeId === 'u-anon');
      expect(shift?.employeeName).toBe('driver@sunny.com');
    });
  });

  it('supports break duration preset buttons (15m, 30m, 45m, 60m)', async () => {
    await timesheetService.clockIn('u-1', 'Trainee Tom', 'manual', 'evt-p');
    render(<TimesheetsClient />);

    fireEvent.click(screen.getByRole('button', { name: /clock out/i }));

    const preset30 = screen.getByRole('button', { name: '30m' });
    fireEvent.click(preset30);
    const breakInput = screen.getByLabelText(/break duration/i) as HTMLInputElement;
    expect(breakInput.value).toBe('30');

    const preset45 = screen.getByRole('button', { name: '45m' });
    fireEvent.click(preset45);
    expect(breakInput.value).toBe('45');

    fireEvent.change(breakInput, { target: { value: '20' } });
    expect(breakInput.value).toBe('20');
  });

  it('handles missing hours modal inputs, cancellation via top X button, and error handling', async () => {
    render(<TimesheetsClient />);
    fireEvent.click(screen.getByRole('button', { name: /request missing hours/i }));

    const breakInput = screen.getByLabelText(/unpaid break/i);
    fireEvent.change(breakInput, { target: { value: '15' } });

    // Close via modal X button (first close button in dialog)
    const modalHeading = screen.getByRole('heading', { name: /request missing hours/i });
    const modalContainer = modalHeading.closest('div')!;
    const closeBtn = within(modalContainer).getByRole('button');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /request missing hours/i })).toBeNull();

    // Reopen and trigger service failure
    fireEvent.click(screen.getByRole('button', { name: /request missing hours/i }));
    const spy = vi.spyOn(timesheetService, 'requestCorrection').mockRejectedValueOnce(new Error('Backend submission failed'));

    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '2026-10-14T08:00' } });
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '2026-10-14T16:00' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Forgot punch' } });

    fireEvent.click(screen.getByRole('button', { name: /submit for manager review/i }));

    await waitFor(() => {
      expect(screen.getByText(/backend submission failed/i)).toBeDefined();
    });
    spy.mockRestore();
  });

  it('handles shift correction modal inputs, cancel via top X, and error handling', async () => {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date();
    end.setHours(17, 0, 0, 0);
    timesheetStore.saveShift({
      id: 'shift-corr-edit',
      employeeId: 'u-1',
      employeeName: 'Trainee Tom',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: start.toISOString(),
      endAtUtc: end.toISOString(),
      unpaidBreakSeconds: 900,
      startSource: 'checklist_return',
      endSource: 'checklist_return',
      startEventId: 'evt-s1',
      endEventId: 'evt-e1',
      revision: 1,
      createdAt: start.toISOString(),
      updatedAt: end.toISOString(),
      submittedAt: end.toISOString(),
      approvedAt: null,
      approvedBy: null,
    });

    render(<TimesheetsClient />);
    fireEvent.click(screen.getAllByRole('button', { name: /request correction/i })[0]);

    // Test form inputs
    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);
    const breakInput = screen.getByLabelText(/unpaid break/i);

    fireEvent.change(startInput, { target: { value: '2026-10-14T09:00' } });
    fireEvent.change(endInput, { target: { value: '2026-10-14T17:00' } });
    fireEvent.change(breakInput, { target: { value: '30' } });

    // Cancel via top X button
    const modalHeading = screen.getByRole('heading', { name: /request shift correction/i });
    const modalContainer = modalHeading.closest('div')!;
    const closeBtn = within(modalContainer).getByRole('button');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /request shift correction/i })).toBeNull();

    // Reopen and trigger error
    fireEvent.click(screen.getAllByRole('button', { name: /request correction/i })[0]);
    const spy = vi.spyOn(timesheetService, 'requestCorrection').mockRejectedValueOnce(new Error('Correction rejected'));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Typo correction' } });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/correction rejected/i)).toBeDefined();
    });
    spy.mockRestore();
  });

  it('handles manager edit drawer inputs, validation, X button close, and return modal error', async () => {
    mockAuthUser = { id: 'mgr-9', name: 'Manager Morgan', email: 'morgan@sunny.com', role: 'manager' };
    mockAuthRole = 'manager';

    await timesheetService.clockIn('emp-alice', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
    await timesheetService.clockOut('emp-alice', 'manual', 'evt-2', 0, '2026-10-14T20:00:00.000Z');

    render(<TimesheetsClient />);

    const aliceRow = screen.getByText('Alice').closest('tr')!;
    const editBtn = within(aliceRow).getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);

    // Edit inputs
    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);
    fireEvent.change(startInput, { target: { value: '2026-10-14T07:00' } });
    fireEvent.change(endInput, { target: { value: '2026-10-14T15:00' } });

    // Attempt save without reason -> REASON_REQUIRED error
    const drawerHeading = screen.getByRole('heading', { name: /edit shift/i });
    const form = drawerHeading.closest('div')!.parentElement!.parentElement!.querySelector('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/reason_required/i)).toBeDefined();
    });

    // Close via top X button
    const headerContainer = drawerHeading.closest('div')!.parentElement!;
    const closeXBtn = within(headerContainer).getByRole('button');
    fireEvent.click(closeXBtn);
    expect(screen.queryByRole('heading', { name: /edit shift/i })).toBeNull();

    // Open Return modal, close via top X button
    const returnBtn = within(aliceRow).getByRole('button', { name: /return/i });
    fireEvent.click(returnBtn);
    const returnHeading = screen.getByRole('heading', { name: /return shift for correction/i });
    const returnHeader = returnHeading.closest('div')!;
    const returnCloseXBtn = within(returnHeader).getByRole('button');
    fireEvent.click(returnCloseXBtn);
    expect(screen.queryByRole('heading', { name: /return shift for correction/i })).toBeNull();

    // Trigger service failure on return
    fireEvent.click(returnBtn);
    const returnSpy = vi.spyOn(timesheetService, 'returnForCorrection').mockRejectedValueOnce(new Error('Cannot return shift'));
    fireEvent.change(screen.getByLabelText(/manager feedback/i), { target: { value: 'Fix break time' } });
    fireEvent.click(screen.getByRole('button', { name: /^return shift$/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot return shift/i)).toBeDefined();
    });
    returnSpy.mockRestore();
  });

  it('closes audit drawer via top X button', async () => {
    mockAuthUser = { id: 'mgr-9', name: 'Manager Morgan', email: 'morgan@sunny.com', role: 'manager' };
    mockAuthRole = 'manager';

    await timesheetService.clockIn('emp-alice', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
    await timesheetService.clockOut('emp-alice', 'manual', 'evt-2', 0, '2026-10-14T20:00:00.000Z');

    render(<TimesheetsClient />);

    const aliceRow = screen.getByText('Alice').closest('tr')!;
    const auditBtn = within(aliceRow).getByRole('button', { name: /audit/i });
    fireEvent.click(auditBtn);

    const auditHeading = screen.getByRole('heading', { name: /shift audit trail/i });
    const auditHeader = auditHeading.closest('div')!.parentElement!;
    const closeXBtn = within(auditHeader).getByRole('button');
    fireEvent.click(closeXBtn);

    expect(screen.queryByRole('heading', { name: /shift audit trail/i })).toBeNull();
  });

  it('exercises break modal top X, correction modal bottom cancel, and mobile card actions', async () => {
    timesheetStore.saveShift({
      id: 'shift-mob-1',
      employeeId: 'u-1',
      employeeName: 'Trainee Tom',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: '2026-10-14T20:00:00.000Z',
      unpaidBreakSeconds: 1800,
      startSource: 'qr',
      endSource: 'checklist_return',
      startEventId: 'evt-s1',
      endEventId: 'evt-e1',
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T20:00:00.000Z',
      submittedAt: '2026-10-14T20:00:00.000Z',
      approvedAt: null,
      approvedBy: null,
      managerNote: 'Please verify break time',
    });

    render(<TimesheetsClient />);

    // Mobile card History button ([1])
    const historyButtons = screen.getAllByRole('button', { name: /history/i });
    expect(historyButtons.length).toBeGreaterThan(1);
    fireEvent.click(historyButtons[1]);
    expect(screen.getByRole('heading', { name: /shift audit trail/i })).toBeDefined();

    // Close trail
    fireEvent.click(screen.getByRole('button', { name: /close trail/i }));

    // Mobile card Request Correction button ([1])
    const corrButtons = screen.getAllByRole('button', { name: /request correction/i });
    expect(corrButtons.length).toBeGreaterThan(1);
    fireEvent.click(corrButtons[1]);
    expect(screen.getByRole('heading', { name: /request shift correction/i })).toBeDefined();

    // Cancel correction via bottom Cancel button (line 1332)
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('heading', { name: /request shift correction/i })).toBeNull();

    // Clock in via UI to transition to active shift
    const clockInBtn = screen.getByRole('button', { name: /clock in/i });
    fireEvent.click(clockInBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clock out/i })).toBeDefined();
    });

    const clockOutBtn = screen.getByRole('button', { name: /clock out/i });
    fireEvent.click(clockOutBtn);
    const breakHeading = screen.getByRole('heading', { name: /unpaid break duration/i });
    const breakHeader = breakHeading.closest('div')!.parentElement!;
    const breakTopXBtn = within(breakHeader).getByRole('button');
    fireEvent.click(breakTopXBtn);
    expect(screen.queryByRole('heading', { name: /unpaid break duration/i })).toBeNull();
  });
});

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T22:00:00Z')); });
afterAll(() => vi.useRealTimers());
