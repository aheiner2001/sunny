import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';
import { dbService } from '@/lib/db';
import ReturnClient from '../ReturnClient';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: () => null }),
}));

let mockUser: { id: string; name: string; email?: string } | null = {
  id: 'emp-202',
  name: 'Dave Driver',
  email: 'dave@sunny.com',
};
let mockRole = 'employee';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: mockRole,
  }),
}));

describe('Return Checklist Clock-Out Integration', () => {
  beforeEach(() => {
    timesheetStore.reset();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockUser = { id: 'emp-202', name: 'Dave Driver', email: 'dave@sunny.com' };
    mockRole = 'employee';
  });

  it('clocks out driver upon return submission and transitions shift to pending', async () => {
    await timesheetService.clockIn('emp-202', 'Dave', 'qr', 'start-evt');
    const closed = await timesheetService.clockOut('emp-202', 'checklist_return', 'return-evt');
    expect(closed.status).toBe('pending');
    expect(closed.endSource).toBe('checklist_return');
    expect(timesheetStore.getActiveShiftGuard('emp-202')?.activeShiftId).toBeNull();
  });

  it('throws NO_ACTIVE_SHIFT if driver has no active shift', async () => {
    await expect(
      timesheetService.clockOut('emp-999', 'checklist_return', 'return-evt-2')
    ).rejects.toThrow('NO_ACTIVE_SHIFT');
  });

  describe('ReturnClient UI Integration', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
      (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);

      // Setup default mock dbService data
      vi.spyOn(dbService, 'getVehicles').mockReturnValue([
        {
          id: 'veh-1',
          vehicleNumber: '101',
          name: 'Van 1',
          status: 'in_use',
          currentUserId: 'emp-202',
          currentUserName: 'Dave Driver',
        } as any,
      ]);

      vi.spyOn(dbService, 'getChecklistConfig').mockReturnValue({
        dailyQuestions: [],
        returnQuestions: [
          {
            id: 'rq-1',
            text: 'Is van cleaned out?',
            type: 'yes_no',
            required: true,
            active: true,
          },
        ],
      } as any);

      vi.spyOn(dbService, 'getMissedReturns').mockReturnValue([]);
      vi.spyOn(dbService, 'getTodayJobsCount').mockReturnValue(3);
      vi.spyOn(dbService, 'submitReturnInspection').mockResolvedValue('insp-123' as any);
      vi.spyOn(dbService, 'setVehicleJobsToday').mockResolvedValue(undefined as any);
    });

    afterEach(async () => {
      if (root) {
        await act(async () => {
          root.unmount();
        });
      }
      container.remove();
      vi.restoreAllMocks();
    });

    it('submits return checklist and clocks out active shift into pending status', async () => {
      // 1. Employee is currently clocked in
      const shift = await timesheetService.clockIn('emp-202', 'Dave Driver', 'qr', 'start-evt');
      expect(shift.status).toBe('active');

      const clockOutSpy = vi.spyOn(timesheetService, 'clockOut');

      await act(async () => {
        root.render(React.createElement(ReturnClient));
      });

      // Fill in required return question
      const yesBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Yes')
      );
      expect(yesBtn).toBeDefined();
      await act(async () => {
        yesBtn!.click();
      });

      // Submit return checklist
      const submitBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Submit return')
      );
      expect(submitBtn).toBeDefined();

      await act(async () => {
        submitBtn!.click();
      });

      // Verify timesheetService.clockOut was called
      expect(clockOutSpy).toHaveBeenCalledTimes(1);
      expect(clockOutSpy).toHaveBeenCalledWith(
        'emp-202',
        'checklist_return',
        expect.stringMatching(/^return-/)
      );

      // Verify shift transitioned to pending
      const updatedShift = timesheetStore.getShift(shift.id);
      expect(updatedShift?.status).toBe('pending');
      expect(updatedShift?.endSource).toBe('checklist_return');

      // Verify active guard cleared
      expect(timesheetStore.getActiveShiftGuard('emp-202')?.activeShiftId).toBeNull();

      // Verify UI shows success return confirmation and timesheet notice / link
      expect(container.textContent).toContain('Returned — 101 available');
      expect(container.textContent).toContain('Shift Clocked Out');
      const timesheetLink = Array.from(container.querySelectorAll('a')).find(
        (a) => a.getAttribute('href') === '/timesheets'
      );
      expect(timesheetLink).toBeDefined();
    });

    it('safely completes return checklist and shows missing shift notice when NO_ACTIVE_SHIFT occurs', async () => {
      // Driver does NOT have an active shift (e.g. forgot to clock in)
      expect(timesheetStore.getActiveShiftGuard('emp-202')?.activeShiftId).toBeUndefined();

      const clockOutSpy = vi.spyOn(timesheetService, 'clockOut');

      await act(async () => {
        root.render(React.createElement(ReturnClient));
      });

      // Fill in required return question
      const yesBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Yes')
      );
      await act(async () => {
        yesBtn!.click();
      });

      // Submit return checklist
      const submitBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Submit return')
      );
      await act(async () => {
        submitBtn!.click();
      });

      expect(clockOutSpy).toHaveBeenCalledTimes(1);
      expect(dbService.submitReturnInspection).toHaveBeenCalledTimes(1);

      // Return still completes successfully!
      expect(container.textContent).toContain('Returned — 101 available');

      // UI presents clear notice for missing shift and direct route to /timesheets
      expect(container.textContent).toContain('No Active Shift Found');
      expect(container.textContent).toContain('Request missing hours in Timesheets');

      const timesheetLinks = Array.from(container.querySelectorAll('a')).filter(
        (a) => a.getAttribute('href') === '/timesheets'
      );
      expect(timesheetLinks.length).toBeGreaterThan(0);
    });

    it('safely completes return checklist even if timesheetService throws an unexpected error', async () => {
      vi.spyOn(timesheetService, 'clockOut').mockRejectedValueOnce(new Error('Storage failure'));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await act(async () => {
        root.render(React.createElement(ReturnClient));
      });

      const yesBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Yes')
      );
      await act(async () => {
        yesBtn!.click();
      });

      const submitBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Submit return')
      );
      await act(async () => {
        submitBtn!.click();
      });

      expect(dbService.submitReturnInspection).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain('Returned — 101 available');
      expect(container.textContent).toContain('Failed to record clock-out punch');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Timesheet clock-out error:',
        expect.any(Error)
      );
    });
  });
});
