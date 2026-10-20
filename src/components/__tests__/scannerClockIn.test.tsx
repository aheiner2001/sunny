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
beforeEach(() => { vi.clearAllMocks(); mocks.clockIn.mockResolvedValue({ status: 'active' }); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('opens the inspection immediately while the employee punch is pending', async () => {
  let finish!: () => void;
  mocks.clockIn.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  render(<QRScannerModal isOpen onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: /101/ }));
  expect(mocks.push).toHaveBeenCalledWith('/inspect?id=van-1&mode=employee');
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Continue to inspection' })).toBeNull();
  finish();
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/inspect?id=van-1&mode=employee'));
  expect(mocks.clockIn).toHaveBeenCalledWith('employee-1', 'Driver', 'qr', expect.any(String));
  expect(mocks.push).toHaveBeenCalledTimes(1);
});
it('opens the inspection even if clock-in fails', async () => {
  mocks.clockIn.mockRejectedValueOnce(new Error('permission-denied'));
  render(<QRScannerModal isOpen onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: /101/ }));
  await waitFor(() => expect(mocks.clockIn).toHaveBeenCalled());
  expect(mocks.push).toHaveBeenCalledWith('/inspect?id=van-1&mode=employee');
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Continue to inspection' })).toBeNull();
});
