import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InspectClient from './InspectClient';

const db = vi.hoisted(() => ({
  getVehicle: vi.fn(() => ({ id: 'van', vehicleNumber: 'Van 1', name: 'Truck', licensePlate: 'TEST', qrCodeToken: 'van', status: 'active', odometer: 12000 })),
  getChecklistConfig: vi.fn(() => ({ categories: [], questions: [], collectOdometer: true, collectFuelLevel: false })),
  getTasks: vi.fn(() => []), getOfflineInspections: vi.fn(() => []), getEquipment: vi.fn(() => []), getInspections: vi.fn(() => []),
  getAppSettings: vi.fn(() => ({ recentInspectorsDepth: 5 })), getRecentInspectors: vi.fn(() => []),
  submitInspection: vi.fn(async (payload: any) => ({ inspection: { ...payload, status: 'passed' }, newIssues: [] })),
  saveOfflineInspection: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ dbService: db }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'employee', name: 'Employee', role: 'employee' }, role: 'employee' }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('id=van'), useRouter: () => ({ push: vi.fn() }) }));

let root: ReturnType<typeof createRoot>;
let el: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  el = document.createElement('div'); document.body.append(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); localStorage.clear(); vi.restoreAllMocks(); });
async function render() { await act(async () => root.render(<InspectClient />)); }
function submit() { return Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Submit Vehicle Inspection'))!; }
function confirmReading() { return el.querySelector<HTMLInputElement>('input[type="checkbox"]')!; }
async function changeMileage(value: string) {
  const input = el.querySelector<HTMLInputElement>('input[type="number"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submitForm() { await act(async () => el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }

it('requires explicit measurement for prefilled mileage and blocks bypassed submission', async () => {
  await render();
  expect(submit().disabled).toBe(true);
  await submitForm(); expect(db.submitInspection).not.toHaveBeenCalled();
  await act(async () => confirmReading().click());
  expect(submit().disabled).toBe(false);
  await submitForm();
  expect(db.submitInspection).toHaveBeenCalledWith(expect.objectContaining({ odometer: 12000, odometerConfirmed: true }));
});
it('invalidates confirmation when the entered mileage changes', async () => {
  await render(); await act(async () => confirmReading().click()); await changeMileage('12100');
  expect(confirmReading().checked).toBe(false); expect(submit().disabled).toBe(true);
});
it('never restores confirmation from a saved draft', async () => {
  localStorage.setItem('sunny_inspection_draft_van', JSON.stringify({ odometer: '12500', odometerConfirmed: true }));
  await render(); expect(confirmReading()?.checked).toBe(false); expect(submit().disabled).toBe(true);
});
it('allows optional mileage to be omitted without changing the inspection submission flow', async () => {
  await render(); await changeMileage(''); expect(submit().disabled).toBe(false); await submitForm();
  expect(db.submitInspection).toHaveBeenCalledWith(expect.objectContaining({ odometer: null, odometerConfirmed: false }));
  expect(el.textContent).toContain('Inspection Submitted!');
});
it('retains the lower mileage warning and excludes the lower reading from confirmed forecasts', async () => {
  await render(); await changeMileage('11000'); await act(async () => confirmReading().click()); await submitForm();
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('less than previous recorded mileage'));
  expect(db.submitInspection).toHaveBeenCalledWith(expect.objectContaining({ odometer: 11000, odometerConfirmed: false }));
});
it('preserves explicit measurement on offline queued inspections', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await render(); await act(async () => confirmReading().click()); await submitForm();
  expect(db.saveOfflineInspection).toHaveBeenCalledWith(expect.objectContaining({ odometer: 12000, odometerConfirmed: true }));
  expect(db.submitInspection).not.toHaveBeenCalled();
});
