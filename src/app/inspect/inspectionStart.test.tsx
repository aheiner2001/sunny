import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import InspectClient from './InspectClient';

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 'jacob', name: 'Jacob', role: 'employee' }, role: 'employee' } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('id=van'), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/firebase', () => ({ db: null, ensureAuth: vi.fn() }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(),
  getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn() }));

it('resumes a draft with its original start but resets the start when Start Over is clicked', async () => {
  vi.useFakeTimers();
  const canvasContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.setSystemTime(new Date('2026-09-30T14:00:00Z'));
  localStorage.clear();
  localStorage.setItem('sunny_seeded_v2', 'true');
  localStorage.setItem('sunny_vehicles', JSON.stringify([{ id: 'van', vehicleNumber: '5', name: 'Truck', status: 'active' }]));
  localStorage.setItem('sunny_inspection_draft_van', JSON.stringify({ startedAt: '2026-09-29T14:00:00Z', responses: {} }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(<InspectClient />));
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(JSON.parse(localStorage.getItem('sunny_inspection_draft_van')!).startedAt).toBe('2026-09-29T14:00:00Z');
    const button = Array.from(container.querySelectorAll('button')).find(row => row.textContent?.trim() === 'Start Over');
    expect(button).toBeDefined();
    await act(async () => button!.click());
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(JSON.parse(localStorage.getItem('sunny_inspection_draft_van')!).startedAt).toBe('2026-09-30T14:00:30.000Z');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    vi.useRealTimers();
    canvasContext.mockRestore();
  }
});
