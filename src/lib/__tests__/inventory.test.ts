import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dbService } from '@/lib/db';
import type { Equipment, Vehicle } from '@/types';

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

async function seedMinimal() {
  localStorage.clear();
  (dbService as any).initialized = false;
  dbService.getVehicles(); // triggers init/seed

  // Clear seeded equipment noise for deterministic tests
  localStorage.setItem('sunny_equipment', JSON.stringify([]));
  localStorage.setItem('sunny_vehicles', JSON.stringify([
    {
      id: 'van-test-1',
      vehicleNumber: 'Van #T1',
      name: 'Test Van',
      licensePlate: 'TEST-1',
      qrCodeToken: 'van-test-1',
      status: 'active',
    },
    {
      id: 'van-test-2',
      vehicleNumber: 'Van #T2',
      name: 'Test Van 2',
      licensePlate: 'TEST-2',
      qrCodeToken: 'van-test-2',
      status: 'active',
    },
  ] as Vehicle[]));
  (dbService as any).initialized = true;
}

describe('inventory sync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    let timestamp = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => timestamp++);
    await seedMinimal();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks reusable totalOwned=5 across assign and return', async () => {
    const created = await dbService.createEquipment({
      name: 'Microfiber Towels',
      kind: 'reusable',
      totalQuantity: 5,
      category: 'supplies',
    });
    expect(created.availableQuantity).toBe(5);

    await dbService.transferEquipmentQuantity(created.id, 'van-test-1', 3, null);
    let eq = dbService.getEquipmentItem(created.id)!;
    expect(eq.availableQuantity).toBe(2);
    expect(eq.assignments?.find(a => a.vehicleId === 'van-test-1')?.quantity).toBe(3);

    await dbService.returnEquipmentToShop(created.id, 'van-test-1', 3);
    eq = dbService.getEquipmentItem(created.id)!;
    expect(eq.availableQuantity).toBe(5);
    expect(eq.assignments || []).toHaveLength(0);
  });

  it('allows assigning more than one unit from shop', async () => {
    const created = await dbService.createEquipment({
      name: 'Polishers',
      kind: 'reusable',
      totalQuantity: 4,
      category: 'equipment',
    });
    const updated = await dbService.transferEquipmentQuantity(created.id, 'van-test-1', 2, null);
    expect(updated.assignments?.[0].quantity).toBe(2);
    expect(updated.availableQuantity).toBe(2);
  });

  it('QR-style bulk transfer vehicle to vehicle and back to shop', async () => {
    const created = await dbService.createEquipment({
      name: 'Hoses',
      kind: 'reusable',
      totalQuantity: 6,
      category: 'equipment',
    });
    await dbService.transferEquipmentQuantity(created.id, 'van-test-1', 4, null);
    await dbService.transferEquipmentQuantity(created.id, 'van-test-2', 2, 'van-test-1');
    let eq = dbService.getEquipmentItem(created.id)!;
    expect(eq.assignments?.find(a => a.vehicleId === 'van-test-1')?.quantity).toBe(2);
    expect(eq.assignments?.find(a => a.vehicleId === 'van-test-2')?.quantity).toBe(2);

    await dbService.returnEquipmentToShop(created.id, 'van-test-2', 2);
    eq = dbService.getEquipmentItem(created.id)!;
    expect(eq.availableQuantity).toBe(4);
    expect(eq.assignments?.some(a => a.vehicleId === 'van-test-2')).toBe(false);
  });

  it('deleteEquipment removes catalog item entirely', async () => {
    const created = await dbService.createEquipment({
      name: 'Doomed',
      kind: 'reusable',
      totalQuantity: 2,
      category: 'equipment',
    });
    await dbService.transferEquipmentQuantity(created.id, 'van-test-1', 1, null);
    await dbService.deleteEquipment(created.id);
    expect(dbService.getEquipmentItem(created.id)).toBeUndefined();
  });

  it('deleteVehicle return_to_shop restores available counts', async () => {
    const created = await dbService.createEquipment({
      name: 'Buckets',
      kind: 'reusable',
      totalQuantity: 3,
      category: 'supplies',
    });
    await dbService.transferEquipmentQuantity(created.id, 'van-test-1', 2, null);
    await dbService.deleteVehicle('van-test-1', { equipmentMode: 'return_to_shop' });
    const eq = dbService.getEquipmentItem(created.id)!;
    expect(eq.availableQuantity).toBe(3);
    expect(eq.assignments || []).toHaveLength(0);
    expect(dbService.getVehicle('van-test-1')).toBeUndefined();
  });

  it('deleteVehicle delete_associated removes sole-assignment catalog items', async () => {
    const sole = await dbService.createEquipment({
      name: 'Sole Item',
      kind: 'reusable',
      totalQuantity: 1,
      category: 'equipment',
    });
    await dbService.transferEquipmentQuantity(sole.id, 'van-test-1', 1, null);

    const shared = await dbService.createEquipment({
      name: 'Shared Item',
      kind: 'reusable',
      totalQuantity: 2,
      category: 'equipment',
    });
    await dbService.transferEquipmentQuantity(shared.id, 'van-test-1', 1, null);
    await dbService.transferEquipmentQuantity(shared.id, 'van-test-2', 1, null);

    firestoreMocks.setDoc.mockClear();
    firestoreMocks.deleteDoc.mockClear();
    await dbService.deleteVehicle('van-test-1', { equipmentMode: 'delete_associated' });
    expect(dbService.getEquipmentItem(sole.id)).toBeUndefined();
    const still = dbService.getEquipmentItem(shared.id)!;
    expect(still.assignments?.some(a => a.vehicleId === 'van-test-1')).toBe(false);
    expect(still.assignments?.find(a => a.vehicleId === 'van-test-2')?.quantity).toBe(1);
    expect(still.availableQuantity).toBe(1);
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'equipment', id: shared.id }),
      expect.objectContaining({
        assignments: expect.arrayContaining([
          expect.objectContaining({ vehicleId: 'van-test-2', quantity: 1 }),
        ]),
        availableQuantity: 1,
      }),
      { merge: true },
    );
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'equipment', id: sole.id }),
    );
  });

  it('deleteVehicle persists only modified surviving equipment to Firestore', async () => {
    const assigned = await dbService.createEquipment({
      name: 'Assigned Item',
      kind: 'reusable',
      totalQuantity: 2,
      category: 'equipment',
    });
    await dbService.transferEquipmentQuantity(assigned.id, 'van-test-1', 1, null);
    const untouched = await dbService.createEquipment({
      name: 'Untouched Item',
      kind: 'reusable',
      totalQuantity: 1,
      category: 'equipment',
    });
    firestoreMocks.setDoc.mockClear();

    await dbService.deleteVehicle('van-test-1');

    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'equipment', id: assigned.id }),
      expect.objectContaining({
        assignments: [],
        vehicleId: null,
        vehicleNumber: 'Unassigned',
        availableQuantity: 2,
      }),
      { merge: true },
    );
    expect(firestoreMocks.setDoc).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: untouched.id }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('setVehicleAssignmentQuantity moves surplus to shop', async () => {
    const created = await dbService.createEquipment({
      name: 'Towels',
      kind: 'consumable',
      totalQuantity: 30,
      category: 'supplies',
    });
    await dbService.transferEquipmentQuantity(created.id, 'van-test-1', 30, null);
    const updated = await dbService.setVehicleAssignmentQuantity(created.id, 'van-test-1', 5);
    expect(updated.assignments?.find(a => a.vehicleId === 'van-test-1')?.quantity).toBe(5);
    expect(updated.availableQuantity).toBe(25);
  });
});
