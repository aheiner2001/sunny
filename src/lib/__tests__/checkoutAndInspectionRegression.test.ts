import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '../db';
import { occupancyKind, checkOutFields } from '../occupancy';
import { transitionAssignment } from '../vehicleAssignments';
import type { Vehicle, VehicleAssignment } from '@/types';

const commit = vi.fn();
const batchSet = vi.fn();
vi.mock('../firebase', () => ({ db: {}, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  writeBatch: vi.fn(() => ({ set: batchSet, commit })),
}));

describe('Vehicle Check-out & Inspection Regression Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    (dbService as any).inspectionMemory = null;
    (dbService as any).confirmedInspections = new Map();
    localStorage.setItem('sunny_seeded_v2', 'true');
    localStorage.setItem('sunny_overnight_reconciled', new Date().toLocaleDateString('en-CA'));
    commit.mockReset().mockResolvedValue(undefined);
    batchSet.mockReset();
  });

  describe('Occupancy and Stale Shift Auto-Checkout', () => {
    it('returns "free" in occupancyKind when vehicle has a stale shift from yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(8, 0, 0, 0);

      const staleVehicle: Vehicle = {
        id: 'van-stale',
        vehicleNumber: 'Van 101',
        name: 'Van 101',
        licensePlate: 'ABC1234',
        qrCodeToken: 'van-stale',
        status: 'in_use',
        currentUserId: 'yesterday-driver',
        currentUserName: 'Yesterday Driver',
        checkedOutAt: yesterday.toISOString(),
        currentUserStartAt: yesterday.toISOString(),
      };

      const now = new Date();
      now.setHours(9, 0, 0, 0);

      // Even though currentUserId is another user, occupancyKind treats stale vehicle as free
      const kind = occupancyKind(staleVehicle, 'today-driver', now);
      expect(kind).toBe('free');
    });

    it('sets vehicle status to in_use unconditionally in checkOutFields', () => {
      const maintenanceVehicle: Vehicle = {
        id: 'van-maint',
        vehicleNumber: 'Van 102',
        name: 'Van 102',
        licensePlate: 'MAINT1',
        qrCodeToken: 'van-maint',
        status: 'maintenance',
      };

      const checkedOut = checkOutFields(maintenanceVehicle, { id: 'driver-1', name: 'Driver One' });
      expect(checkedOut.status).toBe('in_use');
      expect(checkedOut.currentUserId).toBe('driver-1');
      expect(checkedOut.currentUserName).toBe('Driver One');
    });
  });

  describe('Live takeover and Clock Skew in transitionAssignment', () => {
    it('automatically adjusts clock skew forward by 1s for employee/inspection takeovers without throwing overlap errors', () => {
      const baseTime = new Date('2026-10-08T08:00:00.000Z');
      const assignments: VehicleAssignment[] = [{
        id: 'assign-1',
        vehicleId: 'van-1',
        vehicleNumber: 'Van 1',
        userId: 'driver-prev',
        userName: 'Driver Prev',
        startedAt: '2026-10-08T08:00:05.000Z',
        endedAt: null,
        source: 'employee',
        actorId: 'driver-prev',
        actorName: 'Driver Prev',
        recordedAt: '2026-10-08T08:00:05.000Z',
      }];

      const vehicles: Vehicle[] = [{
        id: 'van-1',
        vehicleNumber: 'Van 1',
        name: 'Van 1',
        licensePlate: 'VAN1',
        qrCodeToken: 'van-1',
        status: 'in_use',
        currentUserId: 'driver-prev',
        currentUserName: 'Driver Prev',
      }];

      // New driver inspection takeover happens with effective time slightly earlier than or equal to previous startedAt
      const result = transitionAssignment(assignments, vehicles, {
        vehicleId: 'van-1',
        user: { id: 'driver-next', name: 'Driver Next' },
        effectiveAt: '2026-10-08T08:00:00.000Z',
        recordedAt: '2026-10-08T08:00:10.000Z',
        source: 'inspection',
        actor: { id: 'driver-next', name: 'Driver Next' },
      });

      expect(result.vehicles.find(v => v.id === 'van-1')?.currentUserId).toBe('driver-next');
      expect(result.vehicles.find(v => v.id === 'van-1')?.status).toBe('in_use');

      // Previous assignment is closed
      const prevAssign = result.assignments.find(a => a.id === 'assign-1');
      expect(prevAssign?.endedAt).toBeTruthy();

      // New assignment was added
      const nextAssign = result.assignments.find(a => a.userId === 'driver-next');
      expect(nextAssign).toBeDefined();
      expect(nextAssign?.endedAt).toBeNull();
      // Started at was adjusted past the previous assignment
      expect(new Date(nextAssign!.startedAt).getTime()).toBeGreaterThanOrEqual(new Date(prevAssign!.startedAt).getTime() + 1000);
    });
  });

  describe('Pre-trip Inspection Submission and Unconditional Checkout', () => {
    it('unconditionally assigns vehicle and marks in_use when issues/defects are flagged', async () => {
      const initialVehicle: Vehicle = {
        id: 'van-test',
        vehicleNumber: 'Van 201',
        name: 'Van 201',
        licensePlate: 'FLG201',
        qrCodeToken: 'van-test',
        status: 'active',
        currentUserId: null,
      };
      localStorage.setItem('sunny_vehicles', JSON.stringify([initialVehicle]));

      const payload = {
        vehicleId: 'van-test',
        userId: 'alex',
        userName: 'Alex Smith',
        userEmail: 'alex@sunnyfleet.com',
        responses: [
          { questionId: 'q-oil', questionText: 'Oil Level', category: 'fluids', value: 'Low', isFlagged: true },
          { questionId: 'q-tire', questionText: 'Tire Pressure', category: 'tires', value: 'Low', isFlagged: true },
        ],
        flaggedIssues: [
          { questionId: 'q-oil', equipmentName: 'Engine Oil', title: 'Oil Level Low', description: 'Needs top-off' },
          { questionId: 'q-tire', equipmentName: 'Tires', title: 'Tire Pressure Low', description: 'Front right tire low' },
        ],
      };

      const result = await dbService.submitInspection(payload);

      // Verify inspection status is issues_found
      expect(result.inspection.status).toBe('issues_found');

      // CRITICAL HARD REQUIREMENT:
      // Flagged issues must NEVER block the user from being checked out / assigned to the vehicle
      const updatedVehicle = dbService.getVehicle('van-test');
      expect(updatedVehicle).toBeDefined();
      expect(updatedVehicle?.currentUserId).toBe('alex');
      expect(updatedVehicle?.currentUserName).toBe('Alex Smith');
      expect(updatedVehicle?.status).toBe('in_use');
      expect(updatedVehicle?.lastInspectionStatus).toBe('issues_found');
      expect(updatedVehicle?.lastInspectionId).toBe(result.inspection.id);

      // Verify vehicle assignment was recorded
      const assignments = dbService.getVehicleAssignments('van-test');
      expect(assignments.some(a => a.userId === 'alex' && !a.endedAt)).toBe(true);
    });

    it('assigns vehicle and marks in_use even if vehicle was previously occupied by someone else or in maintenance', async () => {
      const initialVehicle: Vehicle = {
        id: 'van-occupied',
        vehicleNumber: 'Van 301',
        name: 'Van 301',
        licensePlate: 'OCC301',
        qrCodeToken: 'van-occupied',
        status: 'maintenance',
        currentUserId: 'yesterday-driver',
        currentUserName: 'Yesterday Driver',
      };
      localStorage.setItem('sunny_vehicles', JSON.stringify([initialVehicle]));
      localStorage.setItem('sunny_vehicle_assignments', JSON.stringify([{
        id: 'assign-old',
        vehicleId: 'van-occupied',
        vehicleNumber: 'Van 301',
        userId: 'yesterday-driver',
        userName: 'Yesterday Driver',
        startedAt: '2026-10-07T08:00:00.000Z',
        endedAt: null,
        source: 'employee',
        actorId: 'yesterday-driver',
        actorName: 'Yesterday Driver',
        recordedAt: '2026-10-07T08:00:00.000Z',
      }]));

      const payload = {
        vehicleId: 'van-occupied',
        userId: 'new-driver',
        userName: 'New Driver',
        userEmail: 'new@sunnyfleet.com',
        responses: [
          { questionId: 'q-clean', questionText: 'Clean?', category: 'cab', value: 'yes', isFlagged: false },
        ],
        flaggedIssues: [],
      };

      const result = await dbService.submitInspection(payload);
      expect(result.inspection.status).toBe('passed');

      const updatedVehicle = dbService.getVehicle('van-occupied');
      expect(updatedVehicle?.currentUserId).toBe('new-driver');
      expect(updatedVehicle?.currentUserName).toBe('New Driver');
      expect(updatedVehicle?.status).toBe('in_use');

      // Previous assignment was closed
      const assignments = dbService.getVehicleAssignments('van-occupied');
      const oldAssignment = assignments.find(a => a.id === 'assign-old');
      expect(oldAssignment?.endedAt).toBeTruthy();

      const newAssignment = assignments.find(a => a.userId === 'new-driver');
      expect(newAssignment).toBeDefined();
      expect(newAssignment?.endedAt).toBeNull();
    });
  });

  describe('QR Code Token Resolution & URL Parsing', () => {
    it('resolves vehicle by ID, qrCodeToken, vehicleNumber, or encoded URL string', () => {
      const v: Vehicle = {
        id: 'van-qr-test',
        vehicleNumber: 'VAN-777',
        name: 'Van 777',
        licensePlate: 'QR777',
        qrCodeToken: 'TOKEN-777',
        status: 'active',
      };
      localStorage.setItem('sunny_vehicles', JSON.stringify([v]));

      // Lookup by direct ID
      expect(dbService.getVehicle('van-qr-test')?.id).toBe('van-qr-test');

      // Lookup by qrCodeToken
      expect(dbService.getVehicle('TOKEN-777')?.id).toBe('van-qr-test');

      // Lookup by vehicleNumber
      expect(dbService.getVehicle('VAN-777')?.id).toBe('van-qr-test');

      // Lookup by custom URI scheme
      expect(dbService.getVehicle('sunny://vehicle/van-qr-test')?.id).toBe('van-qr-test');
      expect(dbService.getVehicle('sunny://vehicle/TOKEN-777')?.id).toBe('van-qr-test');

      // Lookup by full web URL
      expect(dbService.getVehicle('https://app.sunnyfleet.com/inspect?id=van-qr-test')?.id).toBe('van-qr-test');

      // Lookup by URL-encoded token
      expect(dbService.getVehicle(encodeURIComponent('https://app.sunnyfleet.com/inspect?id=TOKEN-777'))?.id).toBe('van-qr-test');
    });
  });
});
