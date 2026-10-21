import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InspectClient from '../InspectClient';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';
import { dbService } from '@/lib/db';

const { auth } = vi.hoisted(() => ({
  auth: {
    user: { id: 'emp-55', name: 'Dan Driver', role: 'employee' },
    role: 'employee',
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=van-test&mode=employee'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/firebase', () => ({ db: null, ensureAuth: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

describe('Inspection Form Clock-In Integration', () => {
  let container: HTMLDivElement;
  let root: any;
  let canvasContext: any;

  beforeEach(() => {
    canvasContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    timesheetStore.reset();
    localStorage.clear();

    vi.spyOn(dbService, 'getVehicle').mockReturnValue({
      id: 'van-test',
      vehicleNumber: '105',
      name: 'Test Van',
      status: 'active',
      odometer: 50000,
    } as any);

    vi.spyOn(dbService, 'getChecklistConfig').mockReturnValue({
      categories: [],
      questions: [],
      collectOdometer: false,
      collectFuelLevel: false,
    } as any);

    auth.role = 'employee';
    auth.user = { id: 'emp-55', name: 'Dan Driver', role: 'employee' };

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
    localStorage.clear();
    if (canvasContext) canvasContext.mockRestore();
    vi.restoreAllMocks();
  });

  it('automatically clocks in employee when pre-trip inspection form is submitted', async () => {
    const clockInSpy = vi.spyOn(timesheetService, 'clockIn');
    vi.spyOn(dbService, 'submitInspection').mockResolvedValueOnce({
      inspection: { id: 'insp-123', vehicleId: 'van-test', userId: 'emp-55', status: 'passed' } as any,
      newIssues: [],
    });

    await act(async () => {
      root.render(<InspectClient />);
    });

    // Submit form
    const form = container.querySelector('form');
    expect(form).toBeDefined();

    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(clockInSpy).toHaveBeenCalledTimes(1);
    expect(clockInSpy).toHaveBeenCalledWith(
      'emp-55',
      'Dan Driver',
      'qr',
      expect.stringMatching(/^inspect-/),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('does NOT clock in a manager submitting an inspection', async () => {
    auth.role = 'manager';
    auth.user = { id: 'mgr-1', name: 'Mary Manager', role: 'manager' };

    const clockInSpy = vi.spyOn(timesheetService, 'clockIn');
    vi.spyOn(dbService, 'submitInspection').mockResolvedValueOnce({
      inspection: { id: 'insp-456', vehicleId: 'van-test', userId: 'mgr-1', status: 'passed' } as any,
      newIssues: [],
    });

    await act(async () => {
      root.render(<InspectClient />);
    });

    const form = container.querySelector('form');
    expect(form).toBeDefined();

    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(clockInSpy).not.toHaveBeenCalled();
  });
});
