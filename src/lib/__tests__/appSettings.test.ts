import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '@/lib/db';
import type { Inspection } from '@/types';

vi.mock('@/lib/firebase', () => ({
  db: null,
  ensureAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

const inspection = (
  id: string,
  vehicleId: string,
  userName: string,
  submittedAt: string,
  status: Inspection['status'],
): Inspection => ({
  id,
  vehicleId,
  vehicleNumber: vehicleId,
  userId: `user-${id}`,
  userName,
  userEmail: `${userName}@example.com`,
  status,
  startedAt: submittedAt,
  submittedAt,
  dateString: submittedAt.slice(0, 10),
  responses: [],
  issueIds: [],
});

describe('app settings and recent inspectors', () => {
  beforeEach(() => {
    localStorage.clear();
    (dbService as any).initialized = true;
  });

  it('defaults invalid or missing recent-inspector depth to three', () => {
    expect(dbService.getAppSettings()).toEqual({ recentInspectorsDepth: 3 });

    localStorage.setItem('sunny_app_settings', '{invalid json');
    expect(dbService.getAppSettings()).toEqual({ recentInspectorsDepth: 3 });

    localStorage.setItem('sunny_app_settings', JSON.stringify({ recentInspectorsDepth: 7 }));
    expect(dbService.getAppSettings()).toEqual({ recentInspectorsDepth: 3 });
  });

  it('saves normalized app settings and announces the update', async () => {
    const listener = vi.fn();
    window.addEventListener('sunny_db_update', listener);

    await dbService.saveAppSettings({ recentInspectorsDepth: 1 });

    expect(JSON.parse(localStorage.getItem('sunny_app_settings') || '{}')).toEqual({
      recentInspectorsDepth: 1,
    });
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('sunny_db_update', listener);
  });

  it('returns the configured number of latest completed inspectors for a vehicle', () => {
    localStorage.setItem('sunny_app_settings', JSON.stringify({ recentInspectorsDepth: 1 }));
    localStorage.setItem('sunny_inspections', JSON.stringify([
      inspection('old', 'van-1', 'Older Inspector', '2026-08-23T09:00:00.000Z', 'passed'),
      inspection('other', 'van-2', 'Other Van', '2026-08-25T09:00:00.000Z', 'passed'),
      inspection('draft', 'van-1', 'Draft Inspector', '2026-08-26T09:00:00.000Z', 'in_progress'),
      inspection('new', 'van-1', 'Latest Inspector', '2026-08-24T09:00:00.000Z', 'issues_found'),
    ]));

    expect(dbService.getRecentInspectors('van-1')).toEqual([{
      userName: 'Latest Inspector',
      submittedAt: '2026-08-24T09:00:00.000Z',
      status: 'issues_found',
      inspectionId: 'new',
    }]);

    expect(dbService.getRecentInspectors('van-1', 3).map(row => row.inspectionId)).toEqual([
      'new',
      'old',
    ]);
  });
});
