import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  clockIn: vi.fn(),
  auth: { user: { id: 'employee-1', name: 'Driver', role: 'employee' }, role: 'employee' },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mock.auth }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=van'), useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/firebase', () => ({ db: null, ensureAuth: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(),
  getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn(),
}));
vi.mock('@/lib/timesheets/timesheetService', () => ({ timesheetService: { clockIn: mock.clockIn } }));
import InspectClient from './InspectClient';

beforeEach(() => {
  mock.auth.role = 'employee';
  mock.auth.user.role = 'employee';
  mock.clockIn.mockReset().mockResolvedValue({ status: 'active' });
  localStorage.clear();
  localStorage.setItem('sunny_seeded_v2', 'true');
  localStorage.setItem('sunny_vehicles', JSON.stringify([{ id: 'van', vehicleNumber: '5', name: 'Test Van', status: 'active' }]));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('starts an employee shift at the unchanged printed QR destination', async () => {
  render(<InspectClient />);
  await waitFor(() => expect(mock.clockIn).toHaveBeenCalledWith('employee-1', 'Driver', 'qr', expect.any(String)));
});

it('does not start a manager shift merely viewing an inspection', async () => {
  mock.auth.role = 'manager';
  mock.auth.user.role = 'manager';
  render(<InspectClient />);
  await screen.findByText('Test Van');
  expect(mock.clockIn).not.toHaveBeenCalled();
});

it('shows a failed punch and allows retrying without losing the inspection', async () => {
  mock.clockIn.mockRejectedValueOnce(new Error('permission-denied'));
  render(<InspectClient />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry clock-in' }));
  await waitFor(() => expect(mock.clockIn).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText(/clock-in was not saved/i)).toBeNull());
});

it('still punches an employee whose temporary grant enables manager screens', async () => {
  mock.auth.role = 'manager';
  render(<InspectClient />);
  await waitFor(() => expect(mock.clockIn).toHaveBeenCalledWith('employee-1', 'Driver', 'qr', expect.any(String)));
});
