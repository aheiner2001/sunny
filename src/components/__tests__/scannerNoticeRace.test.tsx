import React from 'react';
import { render, fireEvent, screen, act, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';

const mock = vi.hoisted(() => ({ clockIn: vi.fn(), start: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ role: 'employee', isSessionValid: () => true }) }));
vi.mock('html5-qrcode', () => ({ Html5Qrcode: class { start() { return mock.start(); } clear() {} } }));
vi.mock('@/lib/db', () => ({ dbService: {
  getVehicleByQR: () => ({ id: 'van', vehicleNumber: '101', name: 'Test Van' }),
  getVehicles: () => [{ id: 'van', vehicleNumber: '101', name: 'Test Van' }],
  getSession: () => ({ userId: 'employee', role: 'employee', userName: 'Driver' }),
} }));
vi.mock('@/lib/timesheets/timesheetService', () => ({ timesheetService: { clockIn: mock.clockIn } }));
import { QRScannerModal } from '../QRScannerModal';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mock.clockIn.mockRejectedValue(new Error('permission-denied'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it.each(['success', 'failure'] as const)('never makes camera startup or a failed punch delay inspection entry when startup ends in %s', async outcome => {
  mock.start.mockImplementation(() => outcome === 'success' ? Promise.resolve() : Promise.reject(new Error('camera-denied')));
  render(<QRScannerModal isOpen onClose={() => {}} />);
  // Selection navigates before either asynchronous clock-in or camera startup settles.
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /101/ })));
  expect(mock.push).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Continue to inspection' })).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(mock.start).toHaveBeenCalledTimes(1);
  expect(mock.push).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Continue to inspection' })).toBeNull();

  expect(mock.push).toHaveBeenCalledWith('/inspect?id=van&mode=employee');
  expect(mock.clockIn).not.toHaveBeenCalled();
});
