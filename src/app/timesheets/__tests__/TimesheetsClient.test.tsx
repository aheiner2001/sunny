import { beforeAll, afterAll } from 'vitest';
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

  it('renders actual cloud availability', () => {
    render(<TimesheetsClient />);
    expect(screen.getByText(/local only — cloud sync unavailable/i)).toBeDefined();
  });

  it('styles sync banner with warning tones when cloud sync is unavailable', () => {
    render(<TimesheetsClient />);
    const badge = screen.getByText(/local only — cloud sync unavailable/i);
    const banner = badge.closest('.rounded-xl');
    expect(banner?.className).toMatch(/rose|amber/);
  });

  it('styles sync banner emerald when cloud sync is active', () => {
    vi.spyOn(timesheetStore, 'getSyncStatus').mockReturnValue('Firebase Cloud Sync Active');
    render(<TimesheetsClient />);
    const badge = screen.getByText(/Firebase Cloud Sync Active/i);
    const banner = badge.closest('.rounded-xl');
    expect(banner?.className).toMatch(/emerald/);
  });

  it('styles sync banner with warning tones for permission sync failures', () => {
    vi.spyOn(timesheetStore, 'getSyncStatus').mockReturnValue(
      'Cloud sync failed: Firebase permission denied. Verify Console rules for timesheet collections, then retry.',
    );
    render(<TimesheetsClient />);
    const badge = screen.getByText(/permission denied/i);
    const banner = badge.closest('.rounded-xl');
    expect(banner?.className).toMatch(/rose|amber/);
  });

  it.each([
    'Historical estimate was not saved. Check the error and retry.',
    'Review was not saved. Refresh and retry.',
  ])('styles unsaved operation status with warning tones: %s', (status) => {
    vi.spyOn(timesheetStore, 'getSyncStatus').mockReturnValue(status);
    render(<TimesheetsClient />);
    const banner = screen.getByText(status).closest('.rounded-xl');
    expect(banner?.className).toMatch(/rose|amber/);
    expect(banner?.className).not.toMatch(/emerald/);
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

  it('offers a cloud retry without inserting demonstration payroll data', () => {
    render(<TimesheetsClient />);
    fireEvent.click(screen.getByRole('button', { name: /retry cloud sync/i }));
    expect(screen.queryByRole('button', { name: /load demo shifts/i })).toBeNull();
    expect(timesheetStore.getAllShifts()).toHaveLength(0);
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

describe('TimesheetsClient (Manager sync failure visibility)', () => {
  beforeEach(() => {
    timesheetStore.reset();
    mockAuthUser = {
      id: 'mgr-9',
      name: 'Manager Morgan',
      email: 'morgan@sunny.com',
      role: 'manager',
    };
    mockAuthRole = 'manager';
  });

  it('lists cached team shifts while sync is degraded and avoids success-only banner styling', () => {
    timesheetStore.saveShift({
      id: 'shift-cached-1',
      employeeId: 'emp-alice',
      employeeName: 'Alice',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: '2026-10-14T20:00:00.000Z',
      unpaidBreakSeconds: 0,
      startSource: 'qr',
      endSource: 'checklist_return',
      startEventId: 'evt-a1',
      endEventId: 'evt-a2',
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T20:00:00.000Z',
      submittedAt: '2026-10-14T20:00:00.000Z',
      approvedAt: null,
      approvedBy: null,
    });
    vi.spyOn(timesheetStore, 'getSyncStatus').mockReturnValue(
      'Showing cached timesheets — waiting for cloud confirmation',
    );

    render(<TimesheetsClient />);

    expect(screen.getByText('Alice')).toBeDefined();
    const badge = screen.getByText(/waiting for cloud confirmation/i);
    const banner = badge.closest('.rounded-xl');
    expect(banner?.className).toMatch(/rose|amber|slate/);
    expect(banner?.className).not.toMatch(/emerald/);
  });

  it('does not treat "awaiting" sync status as degraded', () => {
    vi.spyOn(timesheetStore, 'getSyncStatus').mockReturnValue(
      'Historical estimate saved — awaiting manager approval',
    );

    render(<TimesheetsClient />);

    expect(screen.getByText(/No team shifts recorded for this week/i)).toBeDefined();
    expect(
      screen.queryByText(/No timesheets loaded\. Cloud sync failed/i),
    ).toBeNull();
    const badge = screen.getByText(/awaiting manager approval/i);
    const banner = badge.closest('.rounded-xl');
    expect(banner?.className).not.toMatch(/rose|amber/);
  });

  it('shows sync-failure empty state instead of a quiet empty week when no shifts loaded', () => {
    vi.spyOn(timesheetStore, 'getSyncStatus').mockReturnValue(
      'Cloud sync failed: Firebase permission denied. Verify Console rules for timesheet collections, then retry.',
    );

    render(<TimesheetsClient />);

    expect(
      screen.getByText(/No timesheets loaded\. Cloud sync failed — retry or check Firebase permissions\./i),
    ).toBeDefined();
    expect(screen.queryByText(/No team shifts recorded for this week/i)).toBeNull();
  });

  it('uses pending-confirmation copy for an empty cached manager view', () => {
    vi.spyOn(timesheetStore, 'getSyncStatus').mockReturnValue(
      'Showing cached timesheets — waiting for cloud confirmation',
    );

    render(<TimesheetsClient />);

    expect(screen.getByText(/No timesheets are confirmed yet.*retry cloud sync/i)).toBeDefined();
    expect(screen.queryByText(/Cloud sync failed/i)).toBeNull();
  });
});

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T22:00:00Z')); });
afterAll(() => vi.useRealTimers());
