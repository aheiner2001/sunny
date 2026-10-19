import React from 'react';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ push: vi.fn(), clockIn: vi.fn(), close: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ role: 'employee', isSessionValid: () => true }) }));
vi.mock('@/lib/db', () => ({ dbService: {
  getVehicleByQR: () => ({ id: 'van-1', vehicleNumber: '101', name: 'Test Van' }),
  getVehicles: () => [{ id: 'van-1', vehicleNumber: '101', name: 'Test Van' }],
  getSession: () => ({ userId: 'employee-1', role: 'employee', userName: 'Driver' }),
} }));
vi.mock('@/lib/timesheets/timesheetService', () => ({ timesheetService: { clockIn: mocks.clockIn } }));
import { QRScannerModal } from '../QRScannerModal';
beforeEach(() => { vi.clearAllMocks(); mocks.clockIn.mockResolvedValue({ status: 'active' }); });
afterEach(cleanup);
it('waits for the employee punch before routing from the main scanner', async () => {
  let finish!: () => void;
  mocks.clockIn.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  render(<QRScannerModal isOpen onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: /101/ }));
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
  finish();
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/inspect?id=van-1&mode=employee'));
  expect(mocks.clockIn).toHaveBeenCalledWith('employee-1', 'Driver', 'qr', expect.any(String));
});
it('keeps the scanner open and explains a failed clock-in', async () => {
  mocks.clockIn.mockRejectedValueOnce(new Error('permission-denied'));
  render(<QRScannerModal isOpen onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: /101/ }));
  await screen.findByText(/clock-in was not saved/i);
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
});
