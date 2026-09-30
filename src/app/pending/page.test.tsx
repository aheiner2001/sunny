import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import PendingPage from './page';

vi.mock('@/components/ManagerOnly', () => ({ ManagerOnly: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'boss', name: 'Boss' } }) }));
vi.mock('@/lib/firebase', () => ({ db: null, ensureAuth: vi.fn() }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(),
  getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn() }));

afterEach(() => { localStorage.clear(); });
it('shows historical previous-user context in Pending and keeps it when newer assignments arrive', async () => {
  localStorage.clear();
  localStorage.setItem('sunny_seeded_v2', 'true');
  localStorage.setItem('sunny_inspections', JSON.stringify([{ id: 'insp', vehicleId: 'van', userId: 'jacob',
    startedAtRecorded: true,
    startedAt: '2026-09-29T14:30:00Z', submittedAt: '2026-09-29T14:37:06Z' }]));
  localStorage.setItem('sunny_inspection_alerts', JSON.stringify([
    { id: 'report', inspectionId: 'insp', vehicleId: 'van', vehicleNumber: '5', title: 'Cab needs cleaning',
      equipmentName: 'Cab', inspectionKind: 'pretrip', reportedById: 'jacob', reportedByName: 'Jacob',
      reportedAt: '2026-09-29T14:37:06Z', status: 'pending' },
    { id: 'unknown', inspectionId: 'missing', vehicleId: 'other', vehicleNumber: '6', title: 'Fuel low',
      equipmentName: 'Fuel', inspectionKind: 'pretrip', reportedById: 'jacob', reportedByName: 'Jacob',
      reportedAt: '2026-09-29T14:37:06Z', status: 'pending' },
  ]));
  const assignments = [{ id: 'old', vehicleId: 'van', userId: 'alex', userName: 'Alex',
    startedAt: '2026-09-28T14:00:00Z', endedAt: '2026-09-29T00:00:00Z' }];
  localStorage.setItem('sunny_vehicle_assignments', JSON.stringify(assignments));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(<PendingPage />));
    expect(container.textContent).toContain('Previous vehicle user: Alex');
    expect(container.textContent).toContain('Previous user unknown');
    localStorage.setItem('sunny_vehicle_assignments', JSON.stringify([...assignments,
      { ...assignments[0], id: 'new', userId: 'later', userName: 'Later Driver', startedAt: '2026-09-30T14:00:00Z', endedAt: null },
    ]));
    await act(async () => window.dispatchEvent(new Event('sunny_db_update')));
    expect(container.textContent).toContain('Previous vehicle user: Alex');
    expect(container.textContent).not.toContain('Later Driver');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
