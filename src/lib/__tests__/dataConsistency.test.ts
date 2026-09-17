import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dbService } from '@/lib/db';
import type { Vehicle, Equipment, Issue, Inspection, User } from '@/types';

const firestoreMocks = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
  ensureAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, collectionName, id) => ({ collectionName, id })),
  setDoc: firestoreMocks.setDoc,
  deleteDoc: firestoreMocks.deleteDoc,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

async function seedTestFleet() {
  localStorage.clear();
  (dbService as any).initialized = false;
  dbService.getVehicles(); // init seed

  const testUser: User = {
    id: 'user-consist-1',
    name: 'Jordan Detailer',
    email: 'jordan@example.com',
    role: 'employee',
    status: 'active',
    passcode: '4321',
  };

  const testVehicle: Vehicle = {
    id: 'van-consist-1',
    vehicleNumber: 'Van #10',
    name: 'Transit Prime',
    licensePlate: 'ABC-1234',
    qrCodeToken: 'van-10',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
  };

  const testEquipment: Equipment = {
    id: 'eq-consist-1',
    name: 'Rotary Buffer 1000',
    category: 'equipment',
    kind: 'reusable',
    status: 'working',
    totalQuantity: 1,
    availableQuantity: 0,
    vehicleId: 'van-consist-1',
    vehicleNumber: 'Van #10',
    assignments: [
      { vehicleId: 'van-consist-1', vehicleNumber: 'Van #10', quantity: 1 }
    ],
  };

  const testIssue: Issue = {
    id: 'issue-consist-1',
    vehicleId: 'van-consist-1',
    vehicleNumber: 'Van #10',
    equipmentId: 'eq-consist-1',
    equipmentName: 'Rotary Buffer 1000',
    reportedById: 'user-consist-1',
    reportedByName: 'Jordan Detailer',
    reportedAt: new Date().toISOString(),
    dateString: '2026-09-16',
    title: 'Buffer pad loose',
    description: 'Hook and loop worn out',
    status: 'open',
    priority: 'moderate',
  };

  const testInspection: Inspection = {
    id: 'insp-consist-1',
    vehicleId: 'van-consist-1',
    vehicleNumber: 'Van #10',
    userId: 'user-consist-1',
    userName: 'Jordan Detailer',
    userEmail: 'jordan@example.com',
    status: 'issues_found',
    startedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    dateString: '2026-09-16',
    responses: [],
    issueIds: ['issue-consist-1'],
  };

  localStorage.setItem('sunny_users', JSON.stringify([testUser]));
  localStorage.setItem('sunny_vehicles', JSON.stringify([testVehicle]));
  localStorage.setItem('sunny_equipment', JSON.stringify([testEquipment]));
  localStorage.setItem('sunny_issues', JSON.stringify([testIssue]));
  localStorage.setItem('sunny_inspections', JSON.stringify([testInspection]));
  (dbService as any).initialized = true;
}

describe('Cross-entity data consistency & propagation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await seedTestFleet();
  });

  it('cascades vehicleNumber updates across equipment, issues, and inspections', async () => {
    const vehicle = dbService.getVehicle('van-consist-1')!;
    expect(vehicle.vehicleNumber).toBe('Van #10');

    // Rename vehicle
    await dbService.updateVehicle({
      ...vehicle,
      vehicleNumber: 'Van #99 (Apex Rig)',
    });

    // 1. Vehicle itself updated
    expect(dbService.getVehicle('van-consist-1')?.vehicleNumber).toBe('Van #99 (Apex Rig)');

    // 2. Equipment assignment updated
    const eq = dbService.getEquipmentItem('eq-consist-1')!;
    expect(eq.vehicleNumber).toBe('Van #99 (Apex Rig)');
    expect(eq.assignments?.[0]?.vehicleNumber).toBe('Van #99 (Apex Rig)');

    // 3. Issue vehicleNumber cascaded
    const issue = dbService.getIssue('issue-consist-1')!;
    expect(issue.vehicleNumber).toBe('Van #99 (Apex Rig)');

    // 4. Inspection vehicleNumber cascaded
    const insp = dbService.getInspections().find(i => i.id === 'insp-consist-1')!;
    expect(insp.vehicleNumber).toBe('Van #99 (Apex Rig)');
  });

  it('cascades user name updates to active vehicle currentUserName', async () => {
    // Check out vehicle to user
    await dbService.checkOutVehicle('van-consist-1', {
      id: 'user-consist-1',
      name: 'Jordan Detailer',
    });

    const activeVehicleBefore = dbService.getVehicle('van-consist-1')!;
    expect(activeVehicleBefore.status).toBe('in_use');
    expect(activeVehicleBefore.currentUserName).toBe('Jordan Detailer');

    // Update user profile name
    const user = dbService.getUser('user-consist-1')!;
    await dbService.updateUser({
      ...user,
      name: 'Jordan Master Detailer',
    });

    // Vehicle currentUserName must now reflect the new name
    const activeVehicleAfter = dbService.getVehicle('van-consist-1')!;
    expect(activeVehicleAfter.currentUserName).toBe('Jordan Master Detailer');
  });

  it('properly checks in and resets vehicle status to active when driver is deleted', async () => {
    // Check out vehicle to user
    await dbService.checkOutVehicle('van-consist-1', {
      id: 'user-consist-1',
      name: 'Jordan Detailer',
    });

    expect(dbService.getVehicle('van-consist-1')?.status).toBe('in_use');

    // Delete user
    await dbService.deleteUser('user-consist-1');

    // User is removed
    expect(dbService.getUser('user-consist-1')).toBeUndefined();

    // Vehicle must NOT be stuck in in_use with null driver; status must be reset to active
    const vehicleAfter = dbService.getVehicle('van-consist-1')!;
    expect(vehicleAfter.status).toBe('active');
    expect(vehicleAfter.currentUserId).toBeNull();
    expect(vehicleAfter.currentUserName).toBeNull();
  });

  it('cascades equipment name updates to open linked issues', async () => {
    const eq = dbService.getEquipmentItem('eq-consist-1')!;
    expect(eq.name).toBe('Rotary Buffer 1000');

    const issueBefore = dbService.getIssue('issue-consist-1')!;
    expect(issueBefore.equipmentName).toBe('Rotary Buffer 1000');

    // Rename equipment
    await dbService.updateEquipment({
      ...eq,
      name: 'Rotary Buffer 2000 Pro',
    });

    // Equipment itself updated
    expect(dbService.getEquipmentItem('eq-consist-1')?.name).toBe('Rotary Buffer 2000 Pro');

    // Issue equipmentName must reflect the renamed tool
    const issueAfter = dbService.getIssue('issue-consist-1')!;
    expect(issueAfter.equipmentName).toBe('Rotary Buffer 2000 Pro');
  });

  it('removes deleted issueId from inspection issueIds array', async () => {
    const inspBefore = dbService.getInspections().find(i => i.id === 'insp-consist-1')!;
    expect(inspBefore.issueIds).toContain('issue-consist-1');

    // Delete the issue
    await dbService.deleteIssue('issue-consist-1');

    expect(dbService.getIssue('issue-consist-1')).toBeUndefined();

    // Inspection must no longer reference the deleted issue
    const inspAfter = dbService.getInspections().find(i => i.id === 'insp-consist-1')!;
    expect(inspAfter.issueIds).not.toContain('issue-consist-1');
  });

  it('resets linked equipment status to working when an issue is resolved', () => {
    // Flag equipment with issue
    dbService.updateEquipmentStatus('eq-consist-1', 'flagged', 'issue-consist-1');
    expect(dbService.getEquipmentItem('eq-consist-1')?.status).toBe('flagged');
    expect(dbService.getEquipmentItem('eq-consist-1')?.activeIssueId).toBe('issue-consist-1');

    // Resolve the issue
    dbService.updateIssueStatus('issue-consist-1', 'fixed', { id: 'mgr-1', name: 'Manager' }, 'Fixed');

    const eqAfter = dbService.getEquipmentItem('eq-consist-1')!;
    expect(eqAfter.status).toBe('working');
    expect(eqAfter.activeIssueId).toBeNull();
  });
});
