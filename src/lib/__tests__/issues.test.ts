import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '@/lib/db';

vi.mock('@/lib/firebase', () => ({
  db: {},
  ensureAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, collectionName, id) => ({ collectionName, id })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

describe('deleteIssue', () => {
  beforeEach(() => {
    localStorage.clear();
    (dbService as any).initialized = true;
    localStorage.setItem(
      'sunny_issues',
      JSON.stringify([
        {
          id: 'issue-1',
          vehicleId: 'van-1',
          vehicleNumber: 'Van #1',
          equipmentId: 'eq-1',
          equipmentName: 'Bike',
          reportedById: 'u1',
          reportedByName: 'Tester',
          reportedAt: '2026-08-28T12:00:00.000Z',
          dateString: '2026-08-28',
          title: 'Accidental flag',
          description: 'Created by mistake',
          status: 'open',
          statusLogs: [],
        },
      ]),
    );
    localStorage.setItem(
      'sunny_equipment',
      JSON.stringify([
        {
          id: 'eq-1',
          name: 'Bike',
          category: 'equipment',
          kind: 'reusable',
          status: 'flagged',
          activeIssueId: 'issue-1',
          totalQuantity: 1,
          availableQuantity: 1,
          assignments: [],
        },
      ]),
    );
  });

  it('removes the issue and clears equipment activeIssueId', async () => {
    await dbService.deleteIssue('issue-1');

    expect(dbService.getIssue('issue-1')).toBeUndefined();
    expect(dbService.getIssues()).toHaveLength(0);

    const equipment = dbService.getEquipmentItem('eq-1');
    expect(equipment?.activeIssueId).toBeNull();
    expect(equipment?.status).toBe('working');
  });
});
