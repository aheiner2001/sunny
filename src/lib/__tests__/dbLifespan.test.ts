import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dbService } from '@/lib/db';

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

describe('dbService lifespan and vehicle daily job log tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (dbService as any).initialized = false;
    dbService.resetToDefaults({ syncToCloud: false });
  });

  it('tracks daily jobs for a vehicle and applies delta wear to usage tools', async () => {
    const vehicle = dbService.getVehicles()[0];
    expect(vehicle).toBeDefined();

    // Create a usage-tracked tool assigned to this vehicle
    const tool = await dbService.createEquipment({
      name: 'Detailing Brush Set',
      category: 'equipment',
      kind: 'reusable',
      vehicleId: vehicle.id,
      lifespanEnabled: true,
      lifespanMode: 'usage',
      expectedCars: 300,
      carsUsed: 0
    });

    // Create a time-mode tool assigned to this vehicle (should not wear with jobs)
    const timeTool = await dbService.createEquipment({
      name: 'Air Compressor Hose Reel',
      category: 'equipment',
      kind: 'reusable',
      vehicleId: vehicle.id,
      lifespanEnabled: true,
      lifespanMode: 'time',
      expectedMonths: 24,
      lifeStartedAt: new Date().toISOString()
    });

    // Initial jobs today should be 0
    expect(dbService.getTodayJobsCount(vehicle.id)).toBe(0);

    // Set jobs today to 5 (delta +5)
    await dbService.setVehicleJobsToday(vehicle.id, 5, { id: 'u1', name: 'John' });
    expect(dbService.getTodayJobsCount(vehicle.id)).toBe(5);

    // Brush should have 5 carsUsed
    const updatedTool = dbService.getEquipmentItem(tool.id);
    expect(updatedTool?.carsUsed).toBe(5);
    expect(updatedTool?.lifespanStatus).toBe('ok');

    // Time tool should be unaffected
    const updatedTimeTool = dbService.getEquipmentItem(timeTool.id);
    expect(updatedTimeTool?.carsUsed).toBe(0);

    // Detailer corrects jobs today from 5 to 3 (delta -2)
    await dbService.setVehicleJobsToday(vehicle.id, 3, { id: 'u1', name: 'John' });
    expect(dbService.getTodayJobsCount(vehicle.id)).toBe(3);
    const correctedTool = dbService.getEquipmentItem(tool.id);
    expect(correctedTool?.carsUsed).toBe(3);
  });

  it('clamps carsUsed at 0 if negative delta exceeds carsUsed', async () => {
    const vehicle = dbService.getVehicles()[0];
    const tool = await dbService.createEquipment({
      name: 'Brush',
      category: 'equipment',
      vehicleId: vehicle.id,
      lifespanEnabled: true,
      lifespanMode: 'usage',
      expectedCars: 100,
      carsUsed: 1
    });

    // Jobs today set to 5 -> adds 5 (carsUsed: 6)
    await dbService.setVehicleJobsToday(vehicle.id, 5);
    expect(dbService.getEquipmentItem(tool.id)?.carsUsed).toBe(6);

    // If jobs today set to 0 -> delta -5 -> carsUsed = max(0, 6 - 5) = 1
    await dbService.setVehicleJobsToday(vehicle.id, 0);
    expect(dbService.getEquipmentItem(tool.id)?.carsUsed).toBe(1);
  });

  it('updates lifespan status to due_for_review when usage hits expectedCars', async () => {
    const vehicle = dbService.getVehicles()[0];
    const tool = await dbService.createEquipment({
      name: 'Finishing Pad',
      category: 'equipment',
      vehicleId: vehicle.id,
      lifespanEnabled: true,
      lifespanMode: 'usage',
      expectedCars: 10,
      carsUsed: 8
    });

    expect(dbService.getEquipmentItem(tool.id)?.lifespanStatus).toBe('getting_low');

    // 2 more jobs -> hits 10 -> due_for_review
    await dbService.setVehicleJobsToday(vehicle.id, 2);
    const dueItem = dbService.getEquipmentItem(tool.id);
    expect(dueItem?.carsUsed).toBe(10);
    expect(dueItem?.lifespanStatus).toBe('due_for_review');

    // Due for review list should include this tool
    const dueList = dbService.getDueForReviewEquipment();
    expect(dueList.some(item => item.id === tool.id)).toBe(true);
  });

  it('supports manager extend, replaced, and retire actions via dbService', async () => {
    const tool = await dbService.createEquipment({
      name: 'Pad',
      category: 'equipment',
      lifespanEnabled: true,
      lifespanMode: 'usage',
      expectedCars: 10,
      carsUsed: 10
    });

    expect(dbService.getEquipmentItem(tool.id)?.lifespanStatus).toBe('due_for_review');

    // Extend by 20 cars
    const extended = await dbService.extendEquipmentLifespan(tool.id, 20);
    expect(extended.expectedCars).toBe(30);
    expect(extended.lifespanStatus).toBe('ok');

    // Replace (resets carsUsed to 0)
    await dbService.updateEquipment({ ...extended, carsUsed: 30 });
    expect(dbService.getEquipmentItem(tool.id)?.lifespanStatus).toBe('due_for_review');
    const replaced = await dbService.replaceEquipmentLifespan(tool.id);
    expect(replaced.carsUsed).toBe(0);
    expect(replaced.lifespanStatus).toBe('ok');

    // Retire
    const retired = await dbService.retireEquipment(tool.id);
    expect(retired.retiredAt).toBeDefined();
    expect(retired.lifespanStatus).toBeNull();
    expect(dbService.getDueForReviewEquipment().some(item => item.id === tool.id)).toBe(false);
  });

  it('creates N individual lifespan tools each with qty 1 and own life bar', async () => {
    const created = await dbService.createLifespanTrackedUnits(
      {
        name: 'Brushy',
        category: 'equipment',
        kind: 'reusable',
        lifespanMode: 'usage',
        expectedCars: 1
      },
      3
    );

    expect(created).toHaveLength(3);
    expect(created.map(c => c.name).sort()).toEqual(['Brushy #1', 'Brushy #2', 'Brushy #3']);
    for (const unit of created) {
      expect(unit.totalQuantity).toBe(1);
      expect(unit.toolFamily).toBe('Brushy');
      expect(unit.lifespanEnabled).toBe(true);
      expect(unit.expectedCars).toBe(1);
      expect(unit.carsUsed).toBe(0);
      expect(unit.availableQuantity).toBe(1);
    }
  });

  it('wears only the individual tools assigned to the van when jobs are logged', async () => {
    const vehicle = dbService.getVehicles()[0];
    expect(vehicle).toBeDefined();

    const created = await dbService.createLifespanTrackedUnits(
      {
        name: 'Pad',
        category: 'equipment',
        lifespanMode: 'usage',
        expectedCars: 10
      },
      3
    );
    const [onVan, inShopA, inShopB] = created;

    await dbService.transferEquipmentQuantity(onVan.id, vehicle.id, 1, null);

    await dbService.setVehicleJobsToday(vehicle.id, 2);

    expect(dbService.getEquipmentItem(onVan.id)?.carsUsed).toBe(2);
    expect(dbService.getEquipmentItem(inShopA.id)?.carsUsed).toBe(0);
    expect(dbService.getEquipmentItem(inShopB.id)?.carsUsed).toBe(0);
  });

  it('splits a multi-qty lifespan pool into individual tools', async () => {
    const vehicle = dbService.getVehicles()[0];
    const pool = await dbService.createEquipment({
      name: 'Brushy',
      category: 'equipment',
      kind: 'reusable',
      totalQuantity: 3,
      lifespanEnabled: false
    });
    await dbService.transferEquipmentQuantity(pool.id, vehicle.id, 2, null);

    const list = dbService.getEquipment().map(eq =>
      eq.id === pool.id
        ? {
            ...eq,
            lifespanEnabled: true,
            lifespanMode: 'usage' as const,
            expectedCars: 1,
            carsUsed: 0,
            totalQuantity: 3,
            availableQuantity: Math.max(0, 3 - (eq.assignments || []).reduce((s, a) => s + a.quantity, 0))
          }
        : eq
    );
    localStorage.setItem('sunny_equipment', JSON.stringify(list));

    const refreshed = dbService.getEquipmentItem(pool.id);
    expect(refreshed?.totalQuantity).toBe(3);
    expect(refreshed?.lifespanEnabled).toBe(true);

    const individuals = await dbService.splitLifespanEquipmentIntoIndividuals(pool.id);
    expect(individuals).toHaveLength(3);
    expect(dbService.getEquipmentItem(pool.id)).toBeUndefined();

    const assignedIndividuals = individuals.filter(
      i => i.assignments?.some(a => a.vehicleId === vehicle.id)
    );
    const shopIndividuals = individuals.filter(i => (i.availableQuantity ?? 0) > 0);
    expect(assignedIndividuals).toHaveLength(2);
    expect(shopIndividuals).toHaveLength(1);
    for (const unit of individuals) {
      expect(unit.totalQuantity).toBe(1);
      expect(unit.lifespanEnabled).toBe(true);
      expect(unit.expectedCars).toBe(1);
    }
  });
});
