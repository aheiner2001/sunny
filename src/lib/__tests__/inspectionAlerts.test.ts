import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';

vi.mock('../firebase', () => ({ db: null, ensureAuth: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(),
  getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn(),
}));

const flagged = { questionId: 'brakes', questionText: 'Brakes working?', category: 'vehicle', value: 'fail', isFlagged: true, equipmentId: 'brakes', equipmentName: 'Brakes', notes: 'Squealing' };
const payload = {
  vehicleId: 'van-1', userId: 'alex', userName: 'Alex', userEmail: '', responses: [flagged],
  flaggedIssues: [{ questionId: 'brakes', equipmentId: 'brakes', equipmentName: 'Brakes', title: 'Brakes working?', description: 'Squealing' }],
};

describe('inspection review queue', () => {
  beforeEach(() => {
    localStorage.clear();
    (dbService as any).inspectionMemory = null;
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_vehicles', JSON.stringify([{ id: 'van-1', vehicleNumber: '1', status: 'active' }]));
    localStorage.setItem('sunny_users', JSON.stringify([{ id: 'boss', name: 'Boss', role: 'manager', status: 'active' }]));
  });
  it('queues a flag rather than creating an issue, and keeps it when acknowledged', async () => {
    const result = await dbService.submitInspection(payload);
    expect(result.newIssues).toEqual([]);
    expect(result.inspection.issueIds).toEqual([]);
    expect(dbService.getIssues()).toEqual([]);
    const [alert] = dbService.getInspectionAlerts();
    expect(alert.questionId).toBe('brakes');
    expect(alert.reportedByName).toBe('Alex');
    await dbService.reviewInspectionAlert(alert.id, 'acknowledged', { id: 'boss', name: 'Boss' }, 'Already being repaired');
    expect(dbService.getInspectionAlerts()[0]).toMatchObject({ status: 'acknowledged', reviewNotes: 'Already being repaired' });
    expect(dbService.getIssues()).toEqual([]);
  });
  it('keeps repeated reports separate and promotes only the selected one', async () => {
    const first = await dbService.submitInspection(payload);
    await dbService.submitInspection(payload);
    const alerts = dbService.getInspectionAlerts();
    expect(alerts).toHaveLength(2);
    expect(alerts[0].id).not.toBe(alerts[1].id);
    await dbService.reviewInspectionAlert(alerts[0].id, 'converted', { id: 'boss', name: 'Boss' }, 'Schedule repair');
    expect(dbService.getIssues()).toHaveLength(1);
    expect(dbService.getIssues()[0].description).toContain('Schedule repair');
    expect(dbService.getInspectionAlerts().find(a => a.id === alerts[1].id)?.status).toBe('pending');
    expect(dbService.getInspections().find(i => i.id === first.inspection.id)?.issueIds).toEqual([]);
    await expect(dbService.reviewInspectionAlert(alerts[0].id, 'converted', { id: 'boss', name: 'Boss' })).rejects.toThrow('already been reviewed');
  });
  it('queues flagged return answers without creating issues', async () => {
    const result = await dbService.submitReturnInspection({ vehicleId: 'van-1', userId: 'alex', userName: 'Alex', userEmail: '', responses: [flagged] });
    expect(result.inspection.status).toBe('issues_found');
    expect(dbService.getInspectionAlerts()[0]).toMatchObject({ inspectionKind: 'return', equipmentName: 'Brakes', status: 'pending' });
    expect(dbService.getIssues()).toEqual([]);
  });
  it('records the actual return checklist start rather than its submission time', async () => {
    const result = await dbService.submitReturnInspection({ vehicleId: 'van-1', userId: 'alex', userName: 'Alex', userEmail: '',
      startedAt: '2026-09-29T14:30:00.000Z', responses: [flagged] });
    expect(result.inspection.startedAt).toBe('2026-09-29T14:30:00.000Z');
    expect(result.inspection.startedAtRecorded).toBe(true);
  });
});

describe('moving existing issues to review', () => {
  beforeEach(() => {
    localStorage.clear();
    (dbService as any).inspectionMemory = null;
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_users', JSON.stringify([{ id: 'boss', name: 'Boss', role: 'manager', status: 'active' }]));
    localStorage.setItem('sunny_equipment', JSON.stringify([{ id: 'brush', name: 'Brush', status: 'needs_repair', activeIssueId: 'old-1' }]));
    localStorage.setItem('sunny_issues', JSON.stringify([{
      id: 'old-1', vehicleId: 'van-1', vehicleNumber: '1', equipmentId: 'brush', equipmentName: 'Brush',
      reportedById: 'alex', reportedByName: 'Alex', reportedAt: '2026-09-01T10:00:00.000Z',
      dateString: '2026-09-01', title: 'Brush worn', description: 'Bristles damaged',
      status: 'needs_repair', priority: 'moderate',
      statusLogs: [{ id: 'log-old', issueId: 'old-1', changedById: 'alex', changedByName: 'Alex',
        oldStatus: 'created', newStatus: 'needs_repair', notes: 'Initial report', timestamp: '2026-09-01T10:00:00.000Z' }],
    }]));
  });

  it('parks selected issues and restores the same issue with its history intact', async () => {
    expect(await dbService.moveIssuesToPending(['old-1'], { id: 'boss', name: 'Boss' })).toBe(1);
    expect(dbService.getOpenIssues()).toHaveLength(0);
    expect(dbService.getEquipmentItem('brush')?.activeIssueId).toBeNull();
    const [alert] = dbService.getInspectionAlerts();
    expect(alert).toMatchObject({ status: 'pending', sourceIssueId: 'old-1', reportedByName: 'Alex' });
    await dbService.reviewInspectionAlert(alert.id, 'converted', { id: 'boss', name: 'Boss' }, 'Still needs repair');
    expect(dbService.getOpenIssues()).toHaveLength(1);
    expect(dbService.getIssues()).toHaveLength(1);
    const restored = dbService.getIssue('old-1')!;
    expect(restored.status).toBe('needs_repair');
    expect(restored.pendingReviewAt).toBeNull();
    expect(dbService.getEquipmentItem('brush')?.activeIssueId).toBe('old-1');
    expect(restored.statusLogs?.map(log => log.notes)).toContain('Initial report');
    expect(restored.statusLogs?.at(-1)?.notes).toContain('Still needs repair');
  });

  it('acknowledges without marking a parked issue repaired or deleting its history', async () => {
    await dbService.moveIssuesToPending(['old-1'], { id: 'boss', name: 'Boss' });
    const [alert] = dbService.getInspectionAlerts();
    await dbService.reviewInspectionAlert(alert.id, 'acknowledged', { id: 'boss', name: 'Boss' });
    expect(dbService.getIssue('old-1')).toMatchObject({ status: 'needs_repair', pendingReviewAt: expect.any(String) });
    expect(dbService.getOpenIssues()).toHaveLength(0);
    expect(dbService.getInspectionAlerts()[0].status).toBe('acknowledged');
  });
});
