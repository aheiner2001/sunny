import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mock = vi.hoisted(() => ({ clockIn: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'employee-1', name: 'Driver', role: 'employee' }, role: 'employee',
}) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('id=van'), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/firebase', () => ({ db: null, ensureAuth: vi.fn() }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(),
  getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn() }));
vi.mock('@/lib/timesheets/timesheetService', () => ({ timesheetService: { clockIn: mock.clockIn } }));
import InspectClient from './InspectClient';
import { dbService } from '@/lib/db';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sunny_seeded_v2', 'true');
  localStorage.setItem('sunny_vehicles', JSON.stringify([{ id: 'van', vehicleNumber: '5', name: 'Test Van', status: 'active' }]));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(dbService, 'getChecklistConfig').mockReturnValue({ categories: [], questions: [], collectOdometer: false, collectFuelLevel: false } as any);
  vi.spyOn(dbService, 'submitInspection').mockResolvedValue({ inspection: { id: 'inspection-1', status: 'passed', responses: [] }, newIssues: [] } as any);
  mock.clockIn.mockReset();
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('inspection submission is independent of timesheet persistence', () => {
  it.each(['failed', 'pending', 'saved'] as const)('submits a valid inspection while clock-in is %s', async status => {
    mock.clockIn.mockImplementation(() => status === 'failed' ? Promise.reject(new Error('permission-denied')) :
      status === 'pending' ? new Promise(() => {}) : Promise.resolve({ status: 'active' }));
    render(<InspectClient />);
    const submit = await screen.findByRole('button', { name: 'Submit Vehicle Inspection' });
    await waitFor(() => expect(mock.clockIn).toHaveBeenCalled());
    if (status === 'failed') await screen.findByRole('button', { name: 'Retry clock-in' });
    fireEvent.click(submit);
    await screen.findByText('Inspection Submitted!');
    expect(dbService.submitInspection).toHaveBeenCalledTimes(1);
    expect(dbService.submitInspection).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'van', userId: 'employee-1' }));
  });

  it('still rejects an incomplete inspection even if clock-in fails', async () => {
    mock.clockIn.mockRejectedValue(new Error('offline'));
    vi.mocked(dbService.getChecklistConfig).mockReturnValue({ categories: [{ id: 'safety', name: 'Safety', order: 0 }],
      questions: [{ id: 'lights', text: 'Lights working?', category: 'safety', type: 'yes_no', required: true, active: true }],
      collectOdometer: false, collectFuelLevel: false } as any);
    render(<InspectClient />);
    const submit = await screen.findByRole('button', { name: 'Submit Vehicle Inspection' });
    await screen.findByRole('button', { name: 'Retry clock-in' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(submit.closest('form')!);
    expect(dbService.submitInspection).not.toHaveBeenCalled();
  });
});
