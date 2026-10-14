import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TimesheetsClient from '../TimesheetsClient';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';
import { timesheetService } from '@/lib/timesheets/timesheetService';

let mockAuthUser = {
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

describe('TimesheetsClient (Employee View)', () => {
  beforeEach(() => {
    timesheetStore.reset();
    mockAuthUser = { id: 'u-1', name: 'Trainee Tom', email: 'tom@sunny.com', role: 'employee' };
    mockAuthRole = 'employee';
  });

  it('renders prototype indicator banner', () => {
    render(<TimesheetsClient />);
    expect(screen.getByText(/timesheet prototype \(isolated test environment\)/i)).toBeDefined();
  });

  it('renders Clock In button when employee is clocked out', () => {
    render(<TimesheetsClient />);
    expect(screen.getByRole('button', { name: /clock in/i })).toBeDefined();
    expect(screen.getByText(/clocked out/i)).toBeDefined();
  });

  it('allows trainee to clock in manually', async () => {
    render(<TimesheetsClient />);
    const clockInBtn = screen.getByRole('button', { name: /clock in/i });
    fireEvent.click(clockInBtn);
    expect(timesheetStore.getActiveShiftGuard('u-1')?.activeShiftId).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clock out/i })).toBeDefined();
    });
  });

  it('renders live punch timer and allows clock out with break duration modal', async () => {
    // Seed an active shift
    await timesheetService.clockIn('u-1', 'Trainee Tom', 'manual', 'evt-seed');
    render(<TimesheetsClient />);

    expect(screen.getByRole('button', { name: /clock out/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /active shift/i })).toBeDefined();

    // Click Clock Out to open break modal
    fireEvent.click(screen.getByRole('button', { name: /clock out/i }));

    // Expect break modal with title / prompt
    expect(screen.getByRole('heading', { name: /unpaid break duration/i })).toBeDefined();

    // Change break minutes or keep 0, then confirm
    const confirmBtn = screen.getByRole('button', { name: /confirm clock out/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(timesheetStore.getActiveShiftGuard('u-1')?.activeShiftId).toBeNull();
    });
  });

  it('displays weekly summary metrics and navigates weeks', async () => {
    render(<TimesheetsClient />);
    expect(screen.getByText(/approved hours/i)).toBeDefined();
    expect(screen.getByText(/pending hours/i)).toBeDefined();
    expect(screen.getByText(/attention/i)).toBeDefined();

    // Week selector buttons
    const prevBtn = screen.getByRole('button', { name: /previous week/i });
    const thisWeekBtn = screen.getByRole('button', { name: /this week/i });
    const nextBtn = screen.getByRole('button', { name: /next week/i });

    expect(prevBtn).toBeDefined();
    expect(thisWeekBtn).toBeDefined();
    expect(nextBtn).toBeDefined();

    fireEvent.click(prevBtn);
    fireEvent.click(thisWeekBtn);
  });

  it('renders shift ledger with source and status badges', async () => {
    // Seed shift
    timesheetStore.saveShift({
      id: 'shift-test-1',
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
    });

    render(<TimesheetsClient />);
    expect(screen.getAllByText('QR').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
  });

  it('allows requesting missing hours via modal', async () => {
    render(<TimesheetsClient />);
    const requestMissingBtn = screen.getByRole('button', { name: /request missing hours/i });
    fireEvent.click(requestMissingBtn);

    expect(screen.getByRole('heading', { name: /request missing hours/i })).toBeDefined();

    // Fill in required fields
    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);
    const reasonInput = screen.getByLabelText(/reason/i);

    fireEvent.change(startInput, { target: { value: '2026-10-14T08:00' } });
    fireEvent.change(endInput, { target: { value: '2026-10-14T16:00' } });
    fireEvent.change(reasonInput, { target: { value: 'Forgot to scan QR code on arrival' } });

    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const requests = timesheetStore.getCorrectionRequestsByEmployee('u-1');
      expect(requests).toHaveLength(1);
      expect(requests[0].reason).toBe('Forgot to scan QR code on arrival');
    });
  });

  it('allows requesting shift correction via modal', async () => {
    timesheetStore.saveShift({
      id: 'shift-corr-1',
      employeeId: 'u-1',
      employeeName: 'Trainee Tom',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: '2026-10-14T20:00:00.000Z',
      unpaidBreakSeconds: 0,
      startSource: 'manual',
      endSource: 'manual',
      startEventId: 'evt-c1',
      endEventId: 'evt-c2',
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T20:00:00.000Z',
      submittedAt: '2026-10-14T20:00:00.000Z',
      approvedAt: null,
      approvedBy: null,
    });

    render(<TimesheetsClient />);
    const correctBtns = screen.getAllByRole('button', { name: /request correction/i });
    fireEvent.click(correctBtns[0]);

    expect(screen.getByRole('heading', { name: /request shift correction/i })).toBeDefined();

    const reasonInput = screen.getByLabelText(/reason/i);
    fireEvent.change(reasonInput, { target: { value: 'Need to add 30m break' } });

    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const requests = timesheetStore.getCorrectionRequestsByEmployee('u-1');
      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].shiftId).toBe('shift-corr-1');
      expect(requests[0].reason).toBe('Need to add 30m break');
    });
  });

  it('supports loading demo shifts and dismissing toast notifications', async () => {
    render(<TimesheetsClient />);
    const loadDemoBtn = screen.getByRole('button', { name: /load demo shifts/i });
    fireEvent.click(loadDemoBtn);

    expect(screen.getByText(/loaded prototype demo shifts/i)).toBeDefined();

    // Dismiss toast notification
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByText(/loaded prototype demo shifts/i)).toBeNull();
  });

  it('supports cancelling modals without submitting', async () => {
    // Seed an active shift for break modal cancellation test
    await timesheetService.clockIn('u-1', 'Trainee Tom', 'manual', 'evt-cancel');
    render(<TimesheetsClient />);

    // Open and cancel Clock Out / Break modal
    fireEvent.click(screen.getByRole('button', { name: /clock out/i }));
    expect(screen.getByRole('heading', { name: /unpaid break duration/i })).toBeDefined();
    const breakCancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(breakCancelBtn);
    expect(screen.queryByRole('heading', { name: /unpaid break duration/i })).toBeNull();

    // Open and cancel Missing Hours modal
    fireEvent.click(screen.getByRole('button', { name: /request missing hours/i }));
    expect(screen.getByRole('heading', { name: /request missing hours/i })).toBeDefined();
    const missingCancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(missingCancelBtn);
    expect(screen.queryByRole('heading', { name: /request missing hours/i })).toBeNull();
  });

  it('supports viewing shift history and opening/closing audit drawer', async () => {
    timesheetStore.saveShift({
      id: 'shift-hist-1',
      employeeId: 'u-1',
      employeeName: 'Trainee Tom',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: '2026-10-14T20:00:00.000Z',
      unpaidBreakSeconds: 0,
      startSource: 'manual',
      endSource: 'manual',
      startEventId: 'evt-h1',
      endEventId: 'evt-h2',
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T20:00:00.000Z',
      submittedAt: '2026-10-14T20:00:00.000Z',
      approvedAt: null,
      approvedBy: null,
    });

    render(<TimesheetsClient />);
    const historyBtn = screen.getAllByRole('button', { name: /history/i })[0];
    fireEvent.click(historyBtn);

    expect(screen.getByRole('heading', { name: /shift audit trail/i })).toBeDefined();

    // Close audit drawer
    const closeBtn = screen.getByRole('button', { name: /close trail/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('heading', { name: /shift audit trail/i })).toBeNull();
  });

  it('displays error notification when clock-in or clock-out service fails', async () => {
    const clockInSpy = vi.spyOn(timesheetService, 'clockIn').mockRejectedValueOnce(new Error('Network offline'));
    render(<TimesheetsClient />);

    fireEvent.click(screen.getByRole('button', { name: /clock in/i }));

    await waitFor(() => {
      expect(screen.getByText(/network offline/i)).toBeDefined();
    });
    clockInSpy.mockRestore();

    // Clock in successfully via UI
    fireEvent.click(screen.getByRole('button', { name: /clock in/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clock out/i })).toBeDefined();
    });

    const clockOutSpy = vi.spyOn(timesheetService, 'clockOut').mockRejectedValueOnce(new Error('Clock-out service unavailable'));

    // Click Clock Out to open modal, then confirm
    fireEvent.click(screen.getByRole('button', { name: /clock out/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm clock out/i }));

    await waitFor(() => {
      expect(screen.getByText(/clock-out service unavailable/i)).toBeDefined();
    });
    clockOutSpy.mockRestore();
  });
});
