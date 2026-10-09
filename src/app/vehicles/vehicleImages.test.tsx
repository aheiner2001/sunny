import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VehiclesPage from './page';

const db = vi.hoisted(() => ({ getVehicles: vi.fn(() => [{ id: 'van', vehicleNumber: 'Van 1', name: 'Truck', licensePlate: 'TEST', qrCodeToken: 'van', status: 'active', imageUrl: 'broken.jpg' }]), getEquipmentOptions: vi.fn(() => []), getEquipmentForVehicle: vi.fn(() => []), createVehicle: vi.fn(), updateVehicle: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbService: db }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ role: 'manager', hydrated: true, isTrueManager: true }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
let root: ReturnType<typeof createRoot>; let el: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  el = document.createElement('div'); document.body.append(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(<VehiclesPage />)); }
async function click(label: string) { const button = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(label))!; await act(async () => button.click()); }
async function upload(file: File) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}
it('shows upload validation errors in the add vehicle form without changing its image or writing records', async () => {
  await render(); await click('Add Vehicle');
  await upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
  expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/5\s?MB/i);
  expect(el.querySelector('img[alt="Vehicle preview"]')).toBeNull();
  expect(db.createVehicle).not.toHaveBeenCalled(); expect(db.updateVehicle).not.toHaveBeenCalled();
});
it('saves only the bounded canvas output from an accepted vehicle image', async () => {
  vi.stubGlobal('Image', class {
    width = 2000; height = 1000; naturalWidth = 2000; naturalHeight = 1000; onload: (() => void) | null = null;
    set src(_: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
    Object.defineProperty(this, 'result', { value: 'data:image/png;base64,original' });
    queueMicrotask(() => this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,c2FmZQ==');
  await render(); await click('Add Vehicle'); await upload(new File(['image'], 'image.png', { type: 'image/png' }));
  expect(el.querySelector<HTMLImageElement>('img[alt="Vehicle preview"]')?.src).toBe('data:image/jpeg;base64,c2FmZQ==');
  await act(async () => el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(db.createVehicle).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'data:image/jpeg;base64,c2FmZQ==' }), []);
});
it('displays a fallback when a vehicle card photo cannot load', async () => {
  await render(); const image = el.querySelector('img')!;
  await act(async () => image.dispatchEvent(new Event('error')));
  expect(image.src).toContain('data:image/svg+xml'); expect(decodeURIComponent(image.src)).toContain('No photo');
});
it('blocks save while image preparation is pending and makes processing visible', async () => {
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(() => {});
  await render(); await click('Add Vehicle'); await upload(new File(['image'], 'pending.png', { type: 'image/png' }));
  expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  expect(el.textContent).toMatch(/preparing image/i);
  await act(async () => el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(db.createVehicle).not.toHaveBeenCalled();
});
