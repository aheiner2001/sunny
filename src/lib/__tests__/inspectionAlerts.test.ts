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
});
