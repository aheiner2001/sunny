import React from 'react';
import { render, fireEvent, screen, waitFor, cleanup, act } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi, describe } from 'vitest';
const mock = vi.hoisted(() => ({ push: vi.fn(), clockIn: vi.fn(), close: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ role: 'employee', isSessionValid: () => true }) }));
vi.mock('html5-qrcode', () => ({ Html5Qrcode: class { start() { return Promise.resolve(); } clear() {} } }));
vi.mock('@/lib/db', () => ({ dbService: {
  getVehicleByQR: () => ({ id: 'van-1', vehicleNumber: '101', name: 'Test Van' }),
  getVehicle: () => ({ id: 'van-1', vehicleNumber: '101', name: 'Test Van' }),
  getVehicles: () => [{ id: 'van-1', vehicleNumber: '101', name: 'Test Van' }],
  getSession: () => ({ userId: 'employee-1', role: 'employee', userName: 'Driver' }),
} }));
vi.mock('@/lib/timesheets/timesheetService', () => ({ timesheetService: { clockIn: mock.clockIn } }));
import { QRScannerModal } from '../QRScannerModal';
import ScanPage from '@/app/scan/page';
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
for (const surface of ['modal', 'page'] as const) describe(surface, () => {
  it.each(['failed', 'pending'] as const)('lets the employee open the inspection when clock-in is %s', async status => {
    let finish!: () => void;
    mock.clockIn.mockImplementation(() => status === 'failed' ? Promise.reject(new Error('permission-denied')) :
      new Promise<void>(resolve => { finish = resolve; }));
    render(surface === 'modal' ? <QRScannerModal isOpen onClose={mock.close} /> : <ScanPage />);
    fireEvent.click(screen.getByRole('button', { name: /101/ }));
    await waitFor(() => expect(mock.clockIn).toHaveBeenCalled());
    if (status === 'failed') await screen.findByText(/clock-in was not saved/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to inspection' }));
    expect(mock.push).toHaveBeenCalledWith('/inspect?id=van-1&mode=employee');
    expect(mock.push).toHaveBeenCalledTimes(1);
    if (status === 'pending') {
      await act(async () => finish());
      expect(mock.push).toHaveBeenCalledTimes(1);
    }
    if (surface === 'modal') expect(mock.close).toHaveBeenCalledTimes(1);
  });
});

it.each(['modal', 'page'] as const)('does not navigate from a late punch after leaving the %s', async surface => {
  let finish!: () => void;
  mock.clockIn.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const view = render(surface === 'modal' ? <QRScannerModal isOpen onClose={mock.close} /> : <ScanPage />);
  fireEvent.click(screen.getByRole('button', { name: /101/ }));
  await waitFor(() => expect(mock.clockIn).toHaveBeenCalled());
  view.unmount();
  await act(async () => finish());
  expect(mock.push).not.toHaveBeenCalled();
  expect(mock.close).not.toHaveBeenCalled();
});
