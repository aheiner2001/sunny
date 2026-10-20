import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
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
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
it('opens immediately and leaves the sole clock-in trigger to checklist entry', () => {
  mocks.clockIn.mockImplementation(() => new Promise(() => {}));
  render(<QRScannerModal isOpen onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: /101/ }));
  expect(mocks.push).toHaveBeenCalledWith('/inspect?id=van-1&mode=employee');
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(mocks.clockIn).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Continue to inspection' })).toBeNull();
});
it('uses the inspection callback immediately without starting a duplicate punch', () => {
  const onScanSuccess = vi.fn();
  render(<QRScannerModal isOpen onClose={mocks.close} onScanSuccess={onScanSuccess} />);
  fireEvent.click(screen.getByRole('button', { name: /101/ }));
  expect(onScanSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'van-1' }));
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(mocks.clockIn).not.toHaveBeenCalled();
});
