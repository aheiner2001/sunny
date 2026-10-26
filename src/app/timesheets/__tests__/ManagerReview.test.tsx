import { beforeAll, afterAll, describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TimesheetsClient from '../TimesheetsClient';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';

let mockAuthUser = {
  id: 'mgr-9',
  name: 'Manager Morgan',
  email: 'morgan@sunny.com',
  role: 'manager',
};
let mockAuthRole = 'manager';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    role: mockAuthRole,
    isAuthenticated: true,
  }),
}));

describe('TimesheetsClient (Manager Review)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-14T14:00:00.000Z'));
    timesheetStore.reset();
    mockAuthUser = {
      id: 'mgr-9',
      name: 'Manager Morgan',
      email: 'morgan@sunny.com',
      role: 'manager',
    };
    mockAuthRole = 'manager';

    // Seed a pending shift from employee Alice
    await timesheetService.clockIn('emp-alice', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
    await timesheetService.clockOut('emp-alice', 'checklist_return', 'evt-2', 0, '2026-10-14T20:00:00.000Z');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders team review table and allows manager approval', async () => {
    render(<TimesheetsClient />);
    expect(screen.getByText(/manager review/i)).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('allows manager to switch tabs between "My Timesheet" and "Manager Review"', async () => {
    render(<TimesheetsClient />);

    // Initially in Manager Review tab
    expect(screen.getByRole('heading', { name: /team shifts/i })).toBeDefined();
    expect(screen.getByText(/team pending/i)).toBeDefined();

    // Switch to "My Timesheet" tab
    const myTimesheetTab = screen.getByRole('button', { name: /my timesheet/i });
    fireEvent.click(myTimesheetTab);

    // Now employee view controls are visible
    expect(screen.getByText(/punch status/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /clock in/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /request missing hours/i })).toBeDefined();

    // Switch back to "Manager Review" tab
    const managerReviewTab = screen.getByRole('button', { name: /manager review/i });
    fireEvent.click(managerReviewTab);

    expect(screen.getByRole('heading', { name: /team shifts/i })).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('filters team shifts table by employee and status', async () => {
    // Seed an approved shift for Bob
    const bobShift = await timesheetService.clockIn('emp-bob', 'Bob', 'manual', 'evt-b1', '2026-10-14T12:00:00.000Z');
    await timesheetService.clockOut('emp-bob', 'manual', 'evt-b2', 1800, '2026-10-14T18:00:00.000Z');
    await timesheetService.approveShift(bobShift.id, { id: 'mgr-9', name: 'Manager Morgan' }, 2);

    // Seed a shift for Charlie that needs correction
    const charlieShift = await timesheetService.clockIn('emp-charlie', 'Charlie', 'manual', 'evt-c1', '2026-10-14T10:00:00.000Z');
    await timesheetService.clockOut('emp-charlie', 'manual', 'evt-c2', 0, '2026-10-14T15:00:00.000Z');
    await timesheetService.returnForCorrection(
      charlieShift.id,
      { id: 'mgr-9', name: 'Manager Morgan' },
      2,
      'Please add your meal break'
    );

    render(<TimesheetsClient />);

    // Initial state: all 3 employees appear in the table
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();

    // Filter by Employee: Alice
    const employeeSelect = screen.getByRole('combobox', { name: /filter by employee/i });
    fireEvent.change(employeeSelect, { target: { value: 'Alice' } });

    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Charlie')).toBeNull();

    // Reset employee filter back to all
    fireEvent.change(employeeSelect, { target: { value: 'all' } });
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();

    // Filter by Status: approved
    const statusSelect = screen.getByRole('combobox', { name: /filter by status/i });
    fireEvent.change(statusSelect, { target: { value: 'approved' } });

    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.queryByText('Charlie')).toBeNull();

    // Filter by Status: needs_correction
    fireEvent.change(statusSelect, { target: { value: 'needs_correction' } });
    expect(screen.getByText('Charlie')).toBeDefined();
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.queryByText('Bob')).toBeNull();

    // Filter by Status: pending
    fireEvent.change(statusSelect, { target: { value: 'pending' } });
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Charlie')).toBeNull();
  });

  it('allows manager to approve a pending shift', async () => {
    render(<TimesheetsClient />);

    // Locate Alice's row
    const aliceCell = screen.getByText('Alice');
    const row = aliceCell.closest('tr')!;
    const approveBtn = within(row).getByRole('button', { name: /approve/i });

    fireEvent.click(approveBtn);

    await waitFor(() => {
      // Alice's shift should now be approved in the store
      const shifts = timesheetStore.getAllShifts();
      const aliceShift = shifts.find((s) => s.employeeName === 'Alice');
      expect(aliceShift?.status).toBe('approved');
      expect(aliceShift?.approvedBy).toBe('mgr-9');
      // Toast notification is shown
      expect(screen.getByText(/approved shift for alice/i)).toBeDefined();
    });

    // The Approve button should no longer be present on Alice's row
    expect(within(row).queryByRole('button', { name: /approve/i })).toBeNull();
  });

  it('allows manager to return a shift with a required feedback note', async () => {
    render(<TimesheetsClient />);

    const aliceCell = screen.getByText('Alice');
    const row = aliceCell.closest('tr')!;
    const returnBtn = within(row).getByRole('button', { name: /return/i });

    // Open Return modal
    fireEvent.click(returnBtn);

    expect(screen.getByRole('heading', { name: /return shift for correction/i })).toBeDefined();
    expect(screen.getByText(/returning shift for/i)).toBeDefined();

    // Fill in feedback note
    const feedbackInput = screen.getByLabelText(/manager feedback/i);
    fireEvent.change(feedbackInput, { target: { value: 'Please log your 30 minute lunch break.' } });

    // Submit return
    const submitBtn = screen.getByRole('button', { name: /^return shift$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const shifts = timesheetStore.getAllShifts();
      const aliceShift = shifts.find((s) => s.employeeName === 'Alice');
      expect(aliceShift?.status).toBe('needs_correction');
      expect(aliceShift?.managerNote).toBe('Please log your 30 minute lunch break.');
      expect(screen.getByText(/shift returned for correction/i)).toBeDefined();
    });
  });

  it('prevents self-approval on manager own shifts (Approve button disabled / hidden)', async () => {
    // Seed a pending shift for the manager themself
    await timesheetService.clockIn('mgr-9', 'Manager Morgan', 'manual', 'evt-m1', '2026-10-14T08:00:00.000Z');
    await timesheetService.clockOut('mgr-9', 'manual', 'evt-m2', 0, '2026-10-14T16:00:00.000Z');

    render(<TimesheetsClient />);

    // Verify manager's own shift row is labeled with (You)
    expect(screen.getByRole('cell', { name: /manager morgan/i })).toBeDefined();
    expect(screen.getByText(/\(you\)/i)).toBeDefined();

    // Alice's row has an active Approve button
    const aliceRow = screen.getByText('Alice').closest('tr')!;
    const aliceApproveBtn = within(aliceRow).getByRole('button', { name: /approve/i });
    expect((aliceApproveBtn as HTMLButtonElement).disabled).toBe(false);

    // Manager Morgan's row either disables or omits the Approve button
    const morganRow = screen.getByRole('cell', { name: /manager morgan/i }).closest('tr')!;
    const morganApproveBtn = within(morganRow).queryByRole('button', { name: /approve/i });
    if (morganApproveBtn) {
      expect((morganApproveBtn as HTMLButtonElement).disabled).toBe(true);
    } else {
      expect(morganApproveBtn).toBeNull();
    }

    // Direct service attempt also throws SELF_APPROVAL_DISABLED
    const mgrShift = timesheetStore.getAllShifts().find((s) => s.employeeId === 'mgr-9')!;
    await expect(
      timesheetService.approveShift(mgrShift.id, { id: 'mgr-9', name: 'Manager Morgan' }, mgrShift.revision)
    ).rejects.toThrow('SELF_APPROVAL_DISABLED');
  });

  it('opens and inspects the shift audit trail drawer', async () => {
    render(<TimesheetsClient />);

    const aliceRow = screen.getByText('Alice').closest('tr')!;
    const auditBtn = within(aliceRow).getByRole('button', { name: /audit/i });

    // Click Audit to open drawer
    fireEvent.click(auditBtn);

    // Verify drawer contents
    expect(screen.getByRole('heading', { name: /shift audit trail/i })).toBeDefined();
    expect(screen.getByText(/revision 2/i)).toBeDefined();
    expect(screen.getByText(/clock in/i)).toBeDefined();
    expect(screen.getByText(/clock out/i)).toBeDefined();

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: /close trail/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /shift audit trail/i })).toBeNull();
  });

  it('allows manager to edit shift details via the edit drawer and handles optimistic revision conflicts', async () => {
    render(<TimesheetsClient />);

    const aliceRow = screen.getByText('Alice').closest('tr')!;
    const editBtn = within(aliceRow).getByRole('button', { name: /edit/i });

    // Open Manager Edit drawer
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: /edit shift/i })).toBeDefined();

    // Fill in break minutes and required reason
    const breakInput = screen.getByLabelText(/unpaid break/i);
    fireEvent.change(breakInput, { target: { value: '45' } });

    const reasonInput = screen.getByLabelText(/reason for edit/i);
    fireEvent.change(reasonInput, { target: { value: 'Adjusted lunch break after review' } });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const shift = timesheetStore.getAllShifts().find((s) => s.employeeName === 'Alice');
      expect(shift?.unpaidBreakSeconds).toBe(2700); // 45 * 60
      expect(shift?.revision).toBe(3);
      expect(shift?.managerNote).toBe('Adjusted lunch break after review');
      expect(screen.getByText(/shift updated successfully/i)).toBeDefined();
    });

    // Verify optimistic revision conflict handling:
    // If shift is updated in background, attempting to save with stale revision fails gracefully
    const currentShift = timesheetStore.getAllShifts().find((s) => s.employeeName === 'Alice')!;
    
    // Open edit again
    const updatedRow = screen.getByText('Alice').closest('tr')!;
    fireEvent.click(within(updatedRow).getByRole('button', { name: /edit/i }));

    // Simulate concurrent modification in store
    timesheetStore.saveShift({
      ...currentShift,
      revision: currentShift.revision + 5,
    });

    const reasonInput2 = screen.getByLabelText(/reason for edit/i);
    fireEvent.change(reasonInput2, { target: { value: 'Another change' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/stale_revision_conflict/i)).toBeDefined();
    });
  });

  it('supports cancelling return modal and manager edit drawer', async () => {
    render(<TimesheetsClient />);

    const aliceRow = screen.getByText('Alice').closest('tr')!;
    const returnBtn = within(aliceRow).getByRole('button', { name: /return/i });

    // Open Return modal and cancel
    fireEvent.click(returnBtn);
    expect(screen.getByRole('heading', { name: /return shift for correction/i })).toBeDefined();
    const returnCancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(returnCancelBtn);
    expect(screen.queryByRole('heading', { name: /return shift for correction/i })).toBeNull();

    // Open Edit drawer and cancel
    const editBtn = within(aliceRow).getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);
    expect(screen.getByRole('heading', { name: /edit shift/i })).toBeDefined();
    const editCancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(editCancelBtn);
    expect(screen.queryByRole('heading', { name: /edit shift/i })).toBeNull();
  });

  it('displays empty state when filtered team shifts have no matches and allows resetting filters', async () => {
    render(<TimesheetsClient />);

    // Filter by nonexistent status
    const statusSelect = screen.getByRole('combobox', { name: /filter by status/i });
    fireEvent.change(statusSelect, { target: { value: 'needs_correction' } });

    expect(screen.getByText(/no shifts match the selected filters/i)).toBeDefined();

    // Click Reset filters
    const resetFiltersBtn = screen.getByRole('button', { name: /reset filters/i });
    fireEvent.click(resetFiltersBtn);

    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('displays error notification when manager approval service fails', async () => {
    const approveSpy = vi.spyOn(timesheetService, 'approveShift').mockRejectedValueOnce(new Error('Permission denied'));
    render(<TimesheetsClient />);

    const aliceRow = screen.getByText('Alice').closest('tr')!;
    const approveBtn = within(aliceRow).getByRole('button', { name: /approve/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeDefined();
    });
    approveSpy.mockRestore();
  });

  it('lists employee correction requests on Manager Review and allows approve', async () => {
    const aliceShift = timesheetStore.getAllShifts().find((s) => s.employeeId === 'emp-alice');
    expect(aliceShift).toBeDefined();

    await timesheetService.requestCorrection({
      shiftId: aliceShift!.id,
      employee: { id: 'emp-alice', name: 'Alice' },
      proposedStart: '2026-10-14T14:00:00.000Z',
      proposedEnd: '2026-10-14T21:00:00.000Z',
      proposedBreakSeconds: 1800,
      reason: 'Forgot unpaid break',
      baseRevision: aliceShift!.revision,
    });

    render(<TimesheetsClient />);

    const queue = screen.getByLabelText(/pending correction requests/i);
    expect(within(queue).getByText(/correction requests \(1\)/i)).toBeDefined();
    expect(within(queue).getByText('Forgot unpaid break')).toBeDefined();
    expect(
      within(queue).getByText((content) => content.startsWith('Shift correction ·')),
    ).toBeDefined();

    fireEvent.click(within(queue).getByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      const requests = timesheetStore.getCorrectionRequestsByEmployee('emp-alice');
      expect(requests.some((r) => r.status === 'approved' && r.reason === 'Forgot unpaid break')).toBe(
        true,
      );
      expect(screen.getByText(/approved correction for alice/i)).toBeDefined();
    });

    expect(within(queue).getByText(/no pending correction requests/i)).toBeDefined();
  });

  it('lets a manager reject a correction request with a required note', async () => {
    await timesheetService.requestCorrection({
      shiftId: null,
      employee: { id: 'emp-alice', name: 'Alice' },
      proposedStart: '2026-10-14T15:00:00.000Z',
      proposedEnd: '2026-10-14T19:00:00.000Z',
      proposedBreakSeconds: 0,
      reason: 'Missed clock-in after pretrip',
    });

    render(<TimesheetsClient />);

    const queue = screen.getByLabelText(/pending correction requests/i);
    fireEvent.click(within(queue).getByRole('button', { name: /^reject$/i }));

    expect(screen.getByRole('heading', { name: /reject correction request/i })).toBeDefined();
    fireEvent.change(screen.getByLabelText(/reject reason/i), {
      target: { value: 'Need vehicle return checklist first' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reject request/i }));

    await waitFor(() => {
      const requests = timesheetStore.getCorrectionRequestsByEmployee('emp-alice');
      expect(requests[0]?.status).toBe('rejected');
      expect(requests[0]?.reviewNote).toBe('Need vehicle return checklist first');
      expect(screen.getByText(/rejected correction for alice/i)).toBeDefined();
    });
  });
});

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T22:00:00Z')); });
afterAll(() => vi.useRealTimers());
