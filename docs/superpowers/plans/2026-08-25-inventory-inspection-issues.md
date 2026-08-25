# Inventory Sync, Inspection Form, Issue Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix inventory assign/return/delete sync (including multi-qty), refactor inspection into a single validated scroll form, add issue types with inventory quick actions, and show recent inspectors (1 or 3) on issue and vehicle detail.

**Architecture:** Keep the embedded `Equipment.assignments[]` model. Extend `dbService` with return-to-shop, assignment quantity set, and vehicle-delete modes; drive UI from those APIs. Add Vitest+jsdom tests against `dbService` with isolated localStorage. Issue typing and recent-inspector helpers stay small pure modules where possible.

**Tech Stack:** Next.js 14 App Router (static export), TypeScript, Tailwind, `dbService` (localStorage + optional Firestore), Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-08-25-inventory-inspection-issues-design.md`

## Global Constraints

- Do **not** introduce a separate `vehicle_equipment` Firestore collection; assignments stay on `Equipment`.
- After every inventory mutation: `availableQuantity === max(0, totalQuantity − sum(assignments.quantity))`; drop zero-qty assignment rows.
- Multi-unit assign (`quantity > 1`) must work when shop/source has stock (reusable and consumable).
- Vehicle delete UI lives on the **Vehicles list** delete modal only (two options).
- Inspection: no default Pass/Yes/Working; submit disabled until required questions answered.
- Recent inspectors = completed inspections on that vehicle; depth `1 | 3` via `AppSettings` (default `3`).
- Tests: Vitest + jsdom against `dbService`; no Playwright in this plan.
- Follow existing UI patterns (alerts, modals, ManagerOnly). Prefer small focused helpers over growing `db.ts` further when logic is pure.

## File map

| File | Responsibility |
|------|----------------|
| `src/types/index.ts` | `requiredQuantity` on assignments; `IssueType`; issue qty fields; `AppSettings` |
| `src/lib/db.ts` | Inventory APIs, delete modes, settings, inspection issue typing, recent inspectors query, quick-action resolve |
| `src/lib/issueClassification.ts` | Pure `classifyIssueType(...)` heuristics |
| `src/lib/inventoryTestUtils.ts` | Test-only seed helpers (or colocate in test file) |
| `vitest.config.ts` | Vitest + jsdom + `@/` alias |
| `package.json` | `test` script + vitest deps |
| `src/lib/__tests__/inventory.test.ts` | Inventory integration tests |
| `src/lib/__tests__/issueClassification.test.ts` | Classification unit tests |
| `src/app/equipment/page.tsx` | In Shop clears all assignments |
| `src/app/vehicles/page.tsx` | Delete modal with two modes |
| `src/app/vehicles/detail/VehicleDetailClient.tsx` | Multi-qty for reusable; return-from-van; par qty; recent inspectors |
| `src/app/equipment/scan/EquipmentScanClient.tsx` | Transfer target can be In Shop |
| `src/app/inspect/InspectClient.tsx` | Single-page form + strict validation |
| `src/app/issues/page.tsx` | Type override, quick actions, recent inspectors |
| `src/app/settings/page.tsx` | Recent inspectors depth control |
| `src/components/RecentInspectors.tsx` | Shared list UI for issue + vehicle detail |

---

### Task 1: Types + Vitest scaffolding

**Files:**
- Modify: `src/types/index.ts`
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/inventory.test.ts` (smoke only in this task)

**Interfaces:**
- Produces: `EquipmentAssignment.requiredQuantity?: number`; `IssueType`; `Issue.type?`, `Issue.reportedQuantity?`, `Issue.requiredQuantity?`; `AppSettings` with `recentInspectorsDepth: 1 | 3`

- [ ] **Step 1: Extend types**

In `src/types/index.ts`, update `EquipmentAssignment`:

```ts
export interface EquipmentAssignment {
  vehicleId: string;
  vehicleNumber: string;
  quantity: number;
  requiredQuantity?: number;
}
```

Add after `IssueStatus`:

```ts
export type IssueType =
  | 'stock_low_inventory'
  | 'equipment_replacement'
  | 'needs_repair';

export interface AppSettings {
  recentInspectorsDepth: 1 | 3;
}
```

On `Issue`, add:

```ts
  type?: IssueType | null;
  reportedQuantity?: number | null;
  requiredQuantity?: number | null;
```

- [ ] **Step 2: Add Vitest**

```bash
npm install -D vitest jsdom @vitejs/plugin-react vite-tsconfig-paths
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write a failing smoke test**

Create `src/lib/__tests__/inventory.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '@/lib/db';

describe('dbService inventory smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    // Force re-init of seed data on next call
    (dbService as any).initialized = false;
  });

  it('exposes returnEquipmentToShop', () => {
    expect(typeof (dbService as any).returnEquipmentToShop).toBe('function');
  });
});
```

- [ ] **Step 4: Run test — expect FAIL**

Run: `npm test -- src/lib/__tests__/inventory.test.ts`  
Expected: FAIL (`returnEquipmentToShop` is not a function) or seed/init issues — either is fine; method must be missing.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts package.json package-lock.json vitest.config.ts src/lib/__tests__/inventory.test.ts
git commit -m "chore: add Vitest and inventory/issue type extensions"
```

---

### Task 2: Inventory core APIs (TDD)

**Files:**
- Modify: `src/lib/db.ts` (`normalizeEquipment`, `deleteVehicle`, new methods)
- Modify: `src/lib/__tests__/inventory.test.ts`

**Interfaces:**
- Consumes: types from Task 1
- Produces:
  - `returnEquipmentToShop(equipmentId: string, vehicleId: string, quantity: number): Promise<Equipment>`
  - `setVehicleAssignmentQuantity(equipmentId: string, vehicleId: string, quantity: number): Promise<Equipment>`
  - `setAssignmentRequiredQuantity(equipmentId: string, vehicleId: string, requiredQuantity: number): Promise<Equipment>`
  - `deleteVehicle(vehicleId: string, options?: { equipmentMode: 'return_to_shop' | 'delete_associated' }): Promise<void>`
  - Default `equipmentMode` = `'return_to_shop'` (backward compatible)

- [ ] **Step 1: Replace smoke test with full inventory suite**

Rewrite `src/lib/__tests__/inventory.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '@/lib/db';
import type { Equipment, Vehicle } from '@/types';

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
    await seedMinimal();
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

    await dbService.deleteVehicle('van-test-1', { equipmentMode: 'delete_associated' });
    expect(dbService.getEquipmentItem(sole.id)).toBeUndefined();
    const still = dbService.getEquipmentItem(shared.id)!;
    expect(still.assignments?.some(a => a.vehicleId === 'van-test-1')).toBe(false);
    expect(still.assignments?.find(a => a.vehicleId === 'van-test-2')?.quantity).toBe(1);
    expect(still.availableQuantity).toBe(1);
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
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/__tests__/inventory.test.ts`  
Expected: FAIL on missing `returnEquipmentToShop` / `setVehicleAssignmentQuantity` / delete options.

- [ ] **Step 3: Implement `normalizeEquipment` to preserve `requiredQuantity`**

In `normalizeEquipment` assignment map, include:

```ts
requiredQuantity:
  a.requiredQuantity !== undefined && a.requiredQuantity !== null
    ? Math.max(0, Number(a.requiredQuantity) || 0)
    : undefined,
```

- [ ] **Step 4: Implement return / set quantity / set required**

Add to `DataStore` after `transferEquipmentQuantity`:

```ts
public async returnEquipmentToShop(
  equipmentId: string,
  vehicleId: string,
  quantity: number
): Promise<Equipment> {
  if (!this.isClient()) throw new Error('Client only');
  const equipment = this.getEquipmentItem(equipmentId);
  if (!equipment) throw new Error('Equipment not found.');
  const amount = Number(quantity);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Quantity must be a positive whole number.');
  }
  const assignments = [...(equipment.assignments || [])];
  const index = assignments.findIndex(a => a.vehicleId === vehicleId);
  if (index < 0) throw new Error('No assignment on that vehicle.');
  const held = assignments[index].quantity;
  if (amount > held) throw new Error(`Only ${held} on that vehicle.`);
  assignments[index] = { ...assignments[index], quantity: held - amount };
  const cleanAssignments = assignments.filter(a => a.quantity > 0);
  const totalQuantity = equipment.totalQuantity ?? 0;
  const assignedQuantity = cleanAssignments.reduce((sum, a) => sum + a.quantity, 0);
  return this.updateEquipment({
    ...equipment,
    assignments: cleanAssignments,
    availableQuantity: Math.max(0, totalQuantity - assignedQuantity),
    vehicleId: cleanAssignments[0]?.vehicleId || null,
    vehicleNumber: cleanAssignments[0]?.vehicleNumber || 'Unassigned',
  });
}

public async setVehicleAssignmentQuantity(
  equipmentId: string,
  vehicleId: string,
  quantity: number
): Promise<Equipment> {
  if (!this.isClient()) throw new Error('Client only');
  const equipment = this.getEquipmentItem(equipmentId);
  const vehicle = this.getVehicle(vehicleId);
  if (!equipment || !vehicle) throw new Error('Equipment or vehicle not found.');
  const nextQty = Number(quantity);
  if (!Number.isInteger(nextQty) || nextQty < 0) {
    throw new Error('Quantity must be a whole number >= 0.');
  }
  const assignments = [...(equipment.assignments || [])];
  const index = assignments.findIndex(a => a.vehicleId === vehicleId);
  const current = index >= 0 ? assignments[index].quantity : 0;
  const delta = nextQty - current;
  const totalQuantity = equipment.totalQuantity ?? 0;
  const assignedOthers = assignments
    .filter(a => a.vehicleId !== vehicleId)
    .reduce((sum, a) => sum + a.quantity, 0);
  const shop = Math.max(0, totalQuantity - (assignedOthers + current));

  if (delta > 0 && delta > shop) {
    throw new Error(`Only ${shop} available in shop.`);
  }

  if (nextQty === 0) {
    const clean = assignments.filter(a => a.vehicleId !== vehicleId);
    const assignedQuantity = clean.reduce((sum, a) => sum + a.quantity, 0);
    return this.updateEquipment({
      ...equipment,
      assignments: clean,
      availableQuantity: Math.max(0, totalQuantity - assignedQuantity),
      vehicleId: clean[0]?.vehicleId || null,
      vehicleNumber: clean[0]?.vehicleNumber || 'Unassigned',
    });
  }

  if (index >= 0) {
    assignments[index] = {
      ...assignments[index],
      vehicleNumber: vehicle.vehicleNumber,
      quantity: nextQty,
    };
  } else {
    assignments.push({
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      quantity: nextQty,
    });
  }
  const cleanAssignments = assignments.filter(a => a.quantity > 0);
  const assignedQuantity = cleanAssignments.reduce((sum, a) => sum + a.quantity, 0);
  return this.updateEquipment({
    ...equipment,
    assignments: cleanAssignments,
    availableQuantity: Math.max(0, totalQuantity - assignedQuantity),
    vehicleId: cleanAssignments[0]?.vehicleId || null,
    vehicleNumber: cleanAssignments[0]?.vehicleNumber || 'Unassigned',
  });
}

public async setAssignmentRequiredQuantity(
  equipmentId: string,
  vehicleId: string,
  requiredQuantity: number
): Promise<Equipment> {
  const equipment = this.getEquipmentItem(equipmentId);
  if (!equipment) throw new Error('Equipment not found.');
  const req = Number(requiredQuantity);
  if (!Number.isInteger(req) || req < 0) {
    throw new Error('Required quantity must be a whole number >= 0.');
  }
  const assignments = (equipment.assignments || []).map(a =>
    a.vehicleId === vehicleId ? { ...a, requiredQuantity: req } : a
  );
  if (!assignments.some(a => a.vehicleId === vehicleId)) {
    throw new Error('No assignment on that vehicle.');
  }
  return this.updateEquipment({ ...equipment, assignments });
}
```

- [ ] **Step 5: Update `deleteVehicle`**

Replace signature and equipment handling:

```ts
public async deleteVehicle(
  vehicleId: string,
  options?: { equipmentMode?: 'return_to_shop' | 'delete_associated' }
): Promise<void> {
  if (!this.isClient()) return;
  const mode = options?.equipmentMode || 'return_to_shop';

  const vehicles = this.getVehicles().filter(v => v.id !== vehicleId);
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));

  let equipment = this.getEquipment();
  if (mode === 'return_to_shop') {
    equipment = equipment.map(e => {
      const assignments = (e.assignments || []).filter(a => a.vehicleId !== vehicleId);
      const total = e.totalQuantity ?? 0;
      return {
        ...e,
        assignments,
        vehicleId: assignments[0]?.vehicleId || null,
        vehicleNumber: assignments[0]?.vehicleNumber || 'Unassigned',
        availableQuantity: Math.max(0, total - assignments.reduce((sum, a) => sum + a.quantity, 0)),
      };
    });
  } else {
    equipment = equipment.flatMap(e => {
      const hadOnlyThis =
        (e.assignments || []).length > 0 &&
        (e.assignments || []).every(a => a.vehicleId === vehicleId);
      if (hadOnlyThis) return [];
      const assignments = (e.assignments || []).filter(a => a.vehicleId !== vehicleId);
      const total = e.totalQuantity ?? 0;
      return [{
        ...e,
        assignments,
        vehicleId: assignments[0]?.vehicleId || null,
        vehicleNumber: assignments[0]?.vehicleNumber || 'Unassigned',
        availableQuantity: Math.max(0, total - assignments.reduce((sum, a) => sum + a.quantity, 0)),
      }];
    });
  }
  localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));

  const inspections = this.getInspections().filter(i => i.vehicleId !== vehicleId);
  localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(inspections));
  const issues = this.getIssues().filter(i => i.vehicleId !== vehicleId);
  localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

  if (db) {
    try {
      await deleteDoc(doc(db, 'vehicles', vehicleId));
      // For delete_associated, delete removed equipment docs best-effort
    } catch (e) {
      console.warn('Firestore delete vehicle fallback to local cache:', e);
    }
  }

  window.dispatchEvent(new Event('sunny_db_update'));
}
```

When `delete_associated` removes catalog items, also best-effort `deleteDoc` for those equipment IDs (capture IDs before flatMap).

- [ ] **Step 6: Run tests — expect PASS**

Run: `npm test -- src/lib/__tests__/inventory.test.ts`  
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/lib/__tests__/inventory.test.ts
git commit -m "fix: sync inventory assign, return-to-shop, and vehicle delete modes"
```

---

### Task 3: Inventory UI (equipment, vehicles, QR)

**Files:**
- Modify: `src/app/equipment/page.tsx` (edit save when `vehicleId` empty)
- Modify: `src/app/vehicles/page.tsx` (delete modal options)
- Modify: `src/app/vehicles/detail/VehicleDetailClient.tsx` (qty for reusable; return button; required qty)
- Modify: `src/app/equipment/scan/EquipmentScanClient.tsx` (target In Shop)

**Interfaces:**
- Consumes: `returnEquipmentToShop`, `deleteVehicle(..., { equipmentMode })`, `setAssignmentRequiredQuantity`

- [ ] **Step 1: Fix equipment edit → In Shop**

In `src/app/equipment/page.tsx` `save` (edit branch), replace assignment preservation logic so clearing the vehicle picker returns everything to shop:

```ts
if (modal === 'edit') {
  if (!vehicle) {
    assignments = [];
  } else if (!existing.some(a => a.vehicleId === vehicle.id)) {
    assignments = [...existing, { vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, quantity: 1 }];
  } else {
    assignments = existing;
  }
  const assignedTotal = assignments.reduce((sum, a) => sum + a.quantity, 0);
  if (assignedTotal > totalQuantity) {
    alert(`${assignedTotal} units are already assigned to vehicles. Total cannot be lower than that.`);
    return;
  }
}
```

Keep `availableQuantity: Math.max(0, totalQuantity - assignments.reduce(...))`.

- [ ] **Step 2: Vehicles list delete modal**

In `src/app/vehicles/page.tsx`:

1. Add state: `const [deleteEquipmentMode, setDeleteEquipmentMode] = useState<'return_to_shop' | 'delete_associated'>('return_to_shop');`
2. Reset to `'return_to_shop'` when opening the delete modal.
3. In the delete modal, replace the single Delete button area with radio options:

```tsx
<div className="text-left space-y-2 mb-6">
  <label className="flex gap-2 items-start text-xs text-slate-700">
    <input
      type="radio"
      name="deleteEquipmentMode"
      checked={deleteEquipmentMode === 'return_to_shop'}
      onChange={() => setDeleteEquipmentMode('return_to_shop')}
      className="mt-0.5"
    />
    <span>
      <strong>Return equipment to shop</strong>
      <span className="block text-slate-500">Delete the vehicle and move its assigned quantities back to global inventory.</span>
    </span>
  </label>
  <label className="flex gap-2 items-start text-xs text-slate-700">
    <input
      type="radio"
      name="deleteEquipmentMode"
      checked={deleteEquipmentMode === 'delete_associated'}
      onChange={() => setDeleteEquipmentMode('delete_associated')}
      className="mt-0.5"
    />
    <span>
      <strong>Delete associated equipment records</strong>
      <span className="block text-slate-500">
        Removes catalog items that were only on this vehicle. Shared items keep other vehicles&apos; stock and only lose this van&apos;s assignment.
      </span>
    </span>
  </label>
</div>
```

4. Call:

```ts
await dbService.deleteVehicle(selectedVehicle.id, { equipmentMode: deleteEquipmentMode });
```

- [ ] **Step 3: Vehicle detail — multi-qty + return + par**

In `VehicleDetailClient.tsx`:

1. Remove the reusable disable on quantity input (`selectedInventory?.kind === 'reusable'`). Allow quantity for both kinds, capped by `selectedInventoryAvailable`.
2. On each assigned equipment row, add:
   - **Return to shop** button → `prompt` for qty (default full held) → `dbService.returnEquipmentToShop(item.id, vehicle.id, amount)`
   - **Required (par)** control → number input or prompt → `dbService.setAssignmentRequiredQuantity(item.id, vehicle.id, req)`

- [ ] **Step 4: Equipment scan — return to shop target**

In `EquipmentScanClient.tsx`, add target option value `""` or sentinel `__shop__`:

- When target is shop: call `dbService.returnEquipmentToShop(equipment.id, sourceVehicleId, amount)` (require `sourceVehicleId`).
- When target is a vehicle: keep `transferEquipmentQuantity`.
- Label option: `In Shop / Unassigned`.

- [ ] **Step 5: Manual smoke (dev)**

Run: `npm run dev`  
Verify: assign 2 from shop to van; return to shop; edit equipment → In Shop clears counts; vehicle delete both modes; QR transfer to shop.

- [ ] **Step 6: Commit**

```bash
git add src/app/equipment/page.tsx src/app/vehicles/page.tsx src/app/vehicles/detail/VehicleDetailClient.tsx src/app/equipment/scan/EquipmentScanClient.tsx
git commit -m "fix: wire inventory return-to-shop and vehicle delete options in UI"
```

---

### Task 4: Inspection single-page form + validation

**Files:**
- Modify: `src/app/inspect/InspectClient.tsx`

**Interfaces:**
- Consumes: existing `submitInspection`; later tasks add issue typing at db layer
- Produces: no default responses; `canSubmit` gate

- [ ] **Step 1: Remove default response initialization**

Delete/replace the block that sets `pass` / `yes` / `working` on load. Only keep empty object or leave unanswered:

```ts
// Do not prefill answers — inspector must explicitly select each required question.
setResponses(prev => prev);
```

Or simply stop initializing defaults (remove the `qList.forEach` defaulting loop).

- [ ] **Step 2: Replace tabs with scroll sections**

Remove `activeTab` / category tab strip / Prev-Next category buttons. Render:

```tsx
{categories.map(cat => {
  const catQuestions = questions
    .filter(q => q.category === cat.id)
    .sort((a, b) => a.order - b.order);
  return (
    <section key={cat.id} className="space-y-3 mb-8">
      <div>
        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">{cat.title}</h2>
        {cat.subtitle && <p className="text-xs text-slate-500 mt-0.5">{cat.subtitle}</p>}
      </div>
      {/* existing question cards for catQuestions */}
    </section>
  );
})}
```

Keep existing per-question answer UI (Working/Flagged, Pass/Fail, etc.) and notes expansion.

- [ ] **Step 3: Strict validation + disabled submit**

```ts
const isAnswered = (q: ChecklistQuestion) => {
  const resp = responses[q.id];
  if (!resp || resp.value === undefined || resp.value === null || resp.value === '') return false;
  return true;
};

const requiredQuestions = questions.filter(q => q.required);
const allRequiredAnswered = requiredQuestions.every(isAnswered);
const flaggedMissingNotes = questions.some(q => {
  const resp = responses[q.id];
  return resp?.isFlagged && !(resp.notes || '').trim();
});
const canSubmit = allRequiredAnswered && !flaggedMissingNotes && !isSubmitting;
```

Wire submit button: `disabled={!canSubmit}`. Show short helper text when disabled: “Answer every required question before submitting.”

In `handleSubmit`, also guard: if any required unanswered, return early (defense in depth). Remove fallback `resp?.value || 'pass'`.

- [ ] **Step 4: Manual check**

Open `/inspect?id=<vehicle>`; confirm no preselected answers; submit disabled until all required answered; categories appear inline while scrolling.

- [ ] **Step 5: Commit**

```bash
git add src/app/inspect/InspectClient.tsx
git commit -m "refactor: single-page inspection form with required-answer validation"
```

---

### Task 5: Issue classification + typed issue creation

**Files:**
- Create: `src/lib/issueClassification.ts`
- Create: `src/lib/__tests__/issueClassification.test.ts`
- Modify: `src/lib/db.ts` (`submitInspection`, `updateIssueType`)

**Interfaces:**
- Produces:
  - `classifyIssueType(input: { title: string; description: string; questionType?: string; value?: string }): IssueType`
  - `submitInspection` sets `Issue.type` (+ optional qty fields when provided on flaggedIssues)
  - `updateIssueType(issueId, type, changedBy): Issue`

- [ ] **Step 1: Write classification tests**

```ts
import { describe, it, expect } from 'vitest';
import { classifyIssueType } from '@/lib/issueClassification';

describe('classifyIssueType', () => {
  it('detects low stock', () => {
    expect(
      classifyIssueType({
        title: 'Microfiber towels',
        description: 'Only 5 left, need 30',
        questionType: 'pass_fail',
        value: 'fail',
      })
    ).toBe('stock_low_inventory');
  });

  it('detects replacement', () => {
    expect(
      classifyIssueType({
        title: 'Hose',
        description: 'Needs replacement — cracked beyond repair',
      })
    ).toBe('equipment_replacement');
  });

  it('defaults equipment_status fail to needs_repair', () => {
    expect(
      classifyIssueType({
        title: 'Compressor',
        description: 'Not turning on',
        questionType: 'equipment_status',
        value: 'flagged',
      })
    ).toBe('needs_repair');
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

Run: `npm test -- src/lib/__tests__/issueClassification.test.ts`

- [ ] **Step 3: Implement classifier**

```ts
import type { IssueType } from '@/types';

export function classifyIssueType(input: {
  title: string;
  description: string;
  questionType?: string;
  value?: string;
}): IssueType {
  const text = `${input.title} ${input.description}`.toLowerCase();
  if (
    /low stock|out of stock|inventory|only \d+|need(s)? \d+|short(age)?|ran out|par level/.test(text)
  ) {
    return 'stock_low_inventory';
  }
  if (/replac(e|ement)|buy new|beyond repair/.test(text)) {
    return 'equipment_replacement';
  }
  if (input.questionType === 'equipment_status' || /repair|broken|not working|flagged/.test(text)) {
    return 'needs_repair';
  }
  return 'needs_repair';
}
```

- [ ] **Step 4: Wire into `submitInspection`**

Extend `flaggedIssues` items with optional `reportedQuantity?: number | null`, `requiredQuantity?: number | null`, `questionType?: string`, `value?: string`.

When creating `newIssue`, set:

```ts
type: classifyIssueType({
  title: flag.title,
  description: flag.description,
  questionType: flag.questionType,
  value: flag.value,
}),
reportedQuantity: flag.reportedQuantity ?? null,
requiredQuantity: flag.requiredQuantity ?? null,
```

From `InspectClient`, when building flagged issues, pass `questionType: q.type` and `value: resp.value`. If notes match `/(\d+)/` twice (actual vs required), optionally parse into `reportedQuantity` / `requiredQuantity` (best-effort; quick actions can still prompt).

- [ ] **Step 5: Add `updateIssueType`**

```ts
public updateIssueType(
  issueId: string,
  type: IssueType,
  changedBy: { id: string; name: string }
): Issue {
  const issues = this.getIssues();
  const idx = issues.findIndex(i => i.id === issueId);
  if (idx < 0) throw new Error('Issue not found');
  const issue = issues[idx];
  const updated: Issue = { ...issue, type };
  // append status log note about type change (reuse updateIssueStatus pattern or dedicated log notes)
  issues[idx] = updated;
  localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));
  window.dispatchEvent(new Event('sunny_db_update'));
  return updated;
}
```

- [ ] **Step 6: Run classification tests — PASS; commit**

```bash
npm test -- src/lib/__tests__/issueClassification.test.ts
git add src/lib/issueClassification.ts src/lib/__tests__/issueClassification.test.ts src/lib/db.ts src/app/inspect/InspectClient.tsx
git commit -m "feat: auto-classify inspection issues and allow type override API"
```

---

### Task 6: Issue quick actions + Issues UI

**Files:**
- Modify: `src/lib/db.ts` (`resolveStockIssue`)
- Modify: `src/app/issues/page.tsx`
- Modify: `src/lib/__tests__/inventory.test.ts` (one quick-action test)

**Interfaces:**
- Produces: `resolveStockIssue(issueId, action: 'update_stock' | 'remove_from_van', changedBy, opts?: { quantity?: number }): Promise<Issue>`

- [ ] **Step 1: Failing test for resolveStockIssue**

Add to inventory test file:

```ts
it('resolveStockIssue update_stock sets assignment and fixes issue', async () => {
  const created = await dbService.createEquipment({
    name: 'Towels',
    kind: 'consumable',
    totalQuantity: 30,
    category: 'supplies',
  });
  await dbService.transferEquipmentQuantity(created.id, 'van-test-1', 30, null);

  // Minimal issue record
  const issues = [{
    id: 'issue-stock-1',
    vehicleId: 'van-test-1',
    vehicleNumber: 'Van #T1',
    equipmentId: created.id,
    equipmentName: 'Towels',
    reportedById: 'u1',
    reportedByName: 'Tester',
    reportedAt: new Date().toISOString(),
    dateString: '2026-08-25',
    title: 'Low towels',
    description: 'actual 5 need 30',
    status: 'open' as const,
    type: 'stock_low_inventory' as const,
    reportedQuantity: 5,
    requiredQuantity: 30,
    statusLogs: [],
  }];
  localStorage.setItem('sunny_issues', JSON.stringify(issues));

  await dbService.resolveStockIssue('issue-stock-1', 'update_stock', { id: 'mgr', name: 'Manager' });
  const eq = dbService.getEquipmentItem(created.id)!;
  expect(eq.assignments?.find(a => a.vehicleId === 'van-test-1')?.quantity).toBe(5);
  expect(eq.availableQuantity).toBe(25);
  expect(dbService.getIssue('issue-stock-1')?.status).toBe('fixed');
});
```

- [ ] **Step 2: Implement `resolveStockIssue`**

```ts
public async resolveStockIssue(
  issueId: string,
  action: 'update_stock' | 'remove_from_van',
  changedBy: { id: string; name: string },
  opts?: { quantity?: number }
): Promise<Issue> {
  const issue = this.getIssue(issueId);
  if (!issue) throw new Error('Issue not found');
  if (!issue.equipmentId) throw new Error('Issue has no linked equipment.');
  if (!issue.vehicleId) throw new Error('Issue has no linked vehicle.');

  if (action === 'update_stock') {
    const qty = opts?.quantity ?? issue.reportedQuantity;
    if (qty === undefined || qty === null || !Number.isInteger(Number(qty)) || Number(qty) < 0) {
      throw new Error('Provide the actual quantity to set on the vehicle.');
    }
    await this.setVehicleAssignmentQuantity(issue.equipmentId, issue.vehicleId, Number(qty));
    return this.updateIssueStatus(
      issueId,
      'fixed',
      changedBy,
      `Update Stock: set van quantity to ${qty}`
    );
  }

  const equipment = this.getEquipmentItem(issue.equipmentId);
  const held =
    equipment?.assignments?.find(a => a.vehicleId === issue.vehicleId)?.quantity ?? 0;
  const amount = opts?.quantity ?? held;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Nothing to remove from van.');
  }
  await this.returnEquipmentToShop(issue.equipmentId, issue.vehicleId, amount);
  return this.updateIssueStatus(
    issueId,
    'fixed',
    changedBy,
    `Remove from Van: returned ${amount} to shop`
  );
}
```

- [ ] **Step 3: Issues page UI**

Using `useAuth()` for manager identity:

1. Show type badge / select on selected issue (`Stock / Low Inventory`, etc.) → `dbService.updateIssueType`.
2. When `issue.type === 'stock_low_inventory'` and `equipmentId` present, show buttons:
   - **Update Stock** → if `reportedQuantity` null, `prompt` for number; call `resolveStockIssue(..., 'update_stock', ..., { quantity })`
   - **Remove from Van** → confirm; optional prompt for qty; call `resolveStockIssue(..., 'remove_from_van', ...)`
3. On missing `equipmentId`, alert: “This issue has no linked equipment; update inventory manually.”

- [ ] **Step 4: Run tests PASS; commit**

```bash
npm test
git add src/lib/db.ts src/lib/__tests__/inventory.test.ts src/app/issues/page.tsx
git commit -m "feat: stock issue quick actions update inventory and resolve"
```

---

### Task 7: AppSettings + recent inspectors

**Files:**
- Modify: `src/types/index.ts` (already has `AppSettings` from Task 1)
- Modify: `src/lib/db.ts` (`STORAGE_KEYS.APP_SETTINGS`, get/save, `getRecentInspectors`)
- Create: `src/components/RecentInspectors.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/issues/page.tsx`
- Modify: `src/app/vehicles/detail/VehicleDetailClient.tsx`

**Interfaces:**
- Produces:
  - `getAppSettings(): AppSettings`
  - `saveAppSettings(settings: AppSettings): Promise<void>`
  - `getRecentInspectors(vehicleId: string, depth?: 1 | 3): Array<{ userName: string; submittedAt: string; status: InspectionStatus; inspectionId: string }>`

- [ ] **Step 1: Persist AppSettings in dbService**

```ts
// STORAGE_KEYS
APP_SETTINGS: 'sunny_app_settings',

public getAppSettings(): AppSettings {
  if (!this.isClient()) return { recentInspectorsDepth: 3 };
  this.init();
  const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
  if (!raw) return { recentInspectorsDepth: 3 };
  try {
    const parsed = JSON.parse(raw) as AppSettings;
    return {
      recentInspectorsDepth: parsed.recentInspectorsDepth === 1 ? 1 : 3,
    };
  } catch {
    return { recentInspectorsDepth: 3 };
  }
}

public async saveAppSettings(settings: AppSettings): Promise<void> {
  if (!this.isClient()) return;
  localStorage.setItem(
    STORAGE_KEYS.APP_SETTINGS,
    JSON.stringify({
      recentInspectorsDepth: settings.recentInspectorsDepth === 1 ? 1 : 3,
    })
  );
  window.dispatchEvent(new Event('sunny_db_update'));
}

public getRecentInspectors(vehicleId: string, depth?: 1 | 3) {
  const n = depth ?? this.getAppSettings().recentInspectorsDepth;
  return this.getInspections()
    .filter(i => i.vehicleId === vehicleId && i.status !== 'in_progress')
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, n)
    .map(i => ({
      userName: i.userName,
      submittedAt: i.submittedAt,
      status: i.status,
      inspectionId: i.id,
    }));
}
```

Seed default in `seedInitialData` / ensure missing key falls back to `{ recentInspectorsDepth: 3 }`.

- [ ] **Step 2: Shared component**

Create `src/components/RecentInspectors.tsx`:

```tsx
'use client';

import { dbService } from '@/lib/db';

export function RecentInspectors({ vehicleId }: { vehicleId: string }) {
  const depth = dbService.getAppSettings().recentInspectorsDepth;
  const rows = dbService.getRecentInspectors(vehicleId, depth);
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">No completed inspections yet.</p>;
  }
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Recent inspectors (last {depth})
      </div>
      <ul className="space-y-1">
        {rows.map(row => (
          <li key={row.inspectionId} className="text-xs text-slate-700 flex justify-between gap-2">
            <span className="font-semibold">{row.userName}</span>
            <span className="text-slate-500">
              {new Date(row.submittedAt).toLocaleString()} · {row.status.replace('_', ' ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Settings control**

On Settings page (manager section), add:

```tsx
const [depth, setDepth] = useState<1 | 3>(dbService.getAppSettings().recentInspectorsDepth);
// radio 1 vs 3
onChange={async (value: 1 | 3) => {
  setDepth(value);
  await dbService.saveAppSettings({ recentInspectorsDepth: value });
}}
```

Copy: “How many recent inspectors to show on issues and vehicle detail.”

- [ ] **Step 4: Mount on Issues + Vehicle detail**

- Issues selected panel: `<RecentInspectors vehicleId={selectedIssue.vehicleId} />`
- Vehicle detail history area: same component with `vehicle.id`

- [ ] **Step 5: Manual verify depth toggle; commit**

```bash
git add src/lib/db.ts src/components/RecentInspectors.tsx src/app/settings/page.tsx src/app/issues/page.tsx src/app/vehicles/detail/VehicleDetailClient.tsx
git commit -m "feat: show recent inspectors with manager depth setting"
```

---

### Task 8: Full verification + docs touch-up

**Files:**
- Modify: `PROJECT_INDEX.md` (brief mentions of Vitest, AppSettings, issue types)
- Modify: `package.json` if scripts missing

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: all inventory + classification tests PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: build succeeds (static export).

- [ ] **Step 3: Update PROJECT_INDEX.md**

Add short bullets under State/Data and Docs for:
- Vitest inventory tests
- Issue types + stock quick actions
- AppSettings recent inspectors depth
- Spec/plan paths under `docs/superpowers/`

- [ ] **Step 4: Final commit**

```bash
git add PROJECT_INDEX.md
git commit -m "docs: note inventory, inspection, and issue workflow updates"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Return to In Shop persists / global counts | Task 2–3 |
| Multi-qty assign | Task 2–3 (API + remove reusable qty disable) |
| Global catalog delete cascades assignments | Task 2 (existing `deleteEquipment` + test) |
| Vehicle delete two options on list modal | Task 2–3 |
| Vehicle-level remove returns to shop | Task 3 |
| Vitest cases 1–4 | Task 2 |
| Single-page inspection + no defaults + required validation | Task 4 |
| Issue types auto + override | Task 5–6 |
| Quick actions Update Stock / Remove from Van | Task 6 |
| Recent inspectors 1\|3 on issue + vehicle detail + setting | Task 7 |
| No `vehicle_equipment` migration / no Playwright | Global constraints |

No intentional placeholders remain; signatures are consistent across tasks (`returnEquipmentToShop`, `setVehicleAssignmentQuantity`, `resolveStockIssue`, `getRecentInspectors`).
