import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';
import { dbService } from '@/lib/db';
import ScanPage from '../page';

const mockPush = vi.fn();
let currentRole = 'employee';
let mockSessionValid = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    role: currentRole,
    isSessionValid: () => mockSessionValid,
  }),
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start() {
      return Promise.reject(new Error('no camera in test'));
    }
    stop() {
      return Promise.resolve();
    }
    clear() {}
  },
}));

describe('QR Scan Clock-In Flow', () => {
  beforeEach(() => {
    timesheetStore.reset();
    mockPush.mockClear();
    currentRole = 'employee';
    mockSessionValid = true;
  });

  it('automatically clocks in employee on vehicle scan and maintains active shift', async () => {
    const shift = await timesheetService.clockIn('emp-101', 'Bob Driver', 'qr', 'scan-evt-1');
    expect(shift.status).toBe('active');
    expect(shift.startSource).toBe('qr');

    const guard = timesheetStore.getActiveShiftGuard('emp-101');
    expect(guard?.activeShiftId).toBe(shift.id);

    // Second scan of another vehicle preserves the same active shift
    const secondScan = await timesheetService.clockIn('emp-101', 'Bob Driver', 'qr', 'scan-evt-2');
    expect(secondScan.id).toBe(shift.id);
  });

  describe('ScanPage Integration', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
      (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
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

    it('does NOT trigger clockIn on scan alone; routes to inspection form without modifying timesheet state', async () => {
      currentRole = 'employee';
      vi.spyOn(dbService, 'getSession').mockReturnValue({
        userId: 'emp-202',
        role: 'employee',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      vi.spyOn(dbService, 'getUser').mockReturnValue({
        id: 'emp-202',
        name: 'Sarah Connor',
        role: 'employee',
        status: 'active',
      } as any);
      vi.spyOn(dbService, 'getVehicles').mockReturnValue([
        { id: 'veh-1', vehicleNumber: '101', name: 'Van 1', status: 'active' } as any,
      ]);

      const clockInSpy = vi.spyOn(timesheetService, 'clockIn');

      await act(async () => {
        root.render(React.createElement(ScanPage));
      });

      // Find quick test selector button for the vehicle
      const vehicleButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('101')
      );
      expect(vehicleButton).toBeDefined();

      await act(async () => {
        vehicleButton!.click();
      });

      // Crucial: Scan does NOT clock the employee in!
      expect(clockInSpy).not.toHaveBeenCalled();
      expect(timesheetStore.getActiveShiftGuard('emp-202')?.activeShiftId).toBeUndefined();
      expect(mockPush).toHaveBeenCalledWith('/inspect?id=veh-1&mode=employee');
    });

    it('does NOT trigger timesheetService.clockIn when manager selects/scans a vehicle', async () => {
      currentRole = 'manager';
      vi.spyOn(dbService, 'getSession').mockReturnValue({
        userId: 'mgr-999',
        role: 'manager',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      vi.spyOn(dbService, 'getVehicles').mockReturnValue([
        { id: 'veh-2', vehicleNumber: '102', name: 'Van 2', status: 'active' } as any,
      ]);

      const clockInSpy = vi.spyOn(timesheetService, 'clockIn');

      await act(async () => {
        root.render(React.createElement(ScanPage));
      });

      const vehicleButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('102')
      );
      expect(vehicleButton).toBeDefined();

      await act(async () => {
        vehicleButton!.click();
      });

      expect(clockInSpy).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/inspect?id=veh-2');
    });

    it('preserves existing active shift when an employee scans a vehicle again', async () => {
      currentRole = 'employee';
      vi.spyOn(dbService, 'getSession').mockReturnValue({
        userId: 'emp-303',
        role: 'employee',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      vi.spyOn(dbService, 'getUser').mockReturnValue({
        id: 'emp-303',
        name: 'John Doe',
        role: 'employee',
        status: 'active',
      } as any);
      vi.spyOn(dbService, 'getVehicles').mockReturnValue([
        { id: 'veh-3', vehicleNumber: '103', name: 'Van 3', status: 'active' } as any,
      ]);

      // Pre-existing active shift (morning time)
      const initialShift = await timesheetService.clockIn('emp-303', 'John Doe', 'qr', 'initial-scan', '2026-10-14T14:00:00.000Z');

      await act(async () => {
        root.render(React.createElement(ScanPage));
      });

      const vehicleButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('103')
      );
      expect(vehicleButton).toBeDefined();

      await act(async () => {
        vehicleButton!.click();
      });

      // Shift is still initialShift
      const guard = timesheetStore.getActiveShiftGuard('emp-303');
      expect(guard?.activeShiftId).toBe(initialShift.id);
      expect(timesheetStore.getShiftsByEmployee('emp-303')).toHaveLength(1);
    });
  });
});
