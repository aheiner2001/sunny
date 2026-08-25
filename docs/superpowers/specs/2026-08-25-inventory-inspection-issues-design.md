# Design: Inventory Sync, Inspection Form, Issue Quick Actions & Recent Inspectors

**Date:** 2026-08-25  
**Status:** Approved (pending written-spec review)  
**Approach:** Fix & extend the current embedded-assignment inventory model (no separate `vehicle_equipment` collection)  
**Stack:** Next.js 14 (static export), TypeScript, Tailwind, `dbService` (localStorage + optional Firestore), Vitest + jsdom

---

## 1. Overview

This work ships as **one combined change set** covering four related areas:

1. **Inventory relational logic** — fix assign/return/delete so shop and vehicle quantities stay consistent, including multi-unit assigns.
2. **Inspection UX** — single scrollable form; no default answers; strict required validation.
3. **Issue management** — type classifications plus manager quick actions that update inventory and resolve in one step.
4. **Recent inspectors** — show who last inspected a vehicle on issue and vehicle detail, with a manager setting for depth (1 or 3).

Existing architecture is preserved: one `equipment` catalog; per-vehicle holdings live in `Equipment.assignments[]`; In Shop stock is `availableQuantity = totalQuantity − Σ(assignment.quantity)`.

---

## 2. Inventory model & sync rules

### 2.1 Data shape (extensions only)

Keep `Equipment` and `EquipmentAssignment`. Extend assignment with optional par level:

```ts
export interface EquipmentAssignment {
  vehicleId: string;
  vehicleNumber: string;
  quantity: number;
  /** Per-vehicle required / par quantity for low-stock checks. */
  requiredQuantity?: number;
}
```

No new Firestore collection. “`vehicle_equipment`” in product language maps to `assignments[]`.

### 2.2 Invariants

- `totalQuantity >= 0` and is the fleet-owned total for that catalog item.
- `sum(assignments.quantity) <= totalQuantity`.
- `availableQuantity === max(0, totalQuantity − sum(assignments.quantity))` after every mutation.
- Zero-quantity assignment rows are removed (no orphan rows).
- Legacy single `vehicleId` / `vehicleNumber` fields remain denormalized mirrors of the first remaining assignment (or null / `"Unassigned"` when none).

### 2.3 Core operations (`dbService`)

| Operation | Behavior |
|-----------|----------|
| **Assign to vehicle** | Move N units from shop (`sourceVehicleId` null) or from another vehicle onto the target. **N may be > 1** (fixes “can’t assign more than one”). |
| **Return to shop / In Shop** | Decrement or remove the source vehicle assignment; shop available increases. First-class API (e.g. `returnEquipmentToShop(equipmentId, vehicleId, quantity)`). |
| **Equipment edit → In Shop** | Selecting empty / In Shop in the catalog edit form sets `assignments` to `[]` and `availableQuantity` to `totalQuantity` (all units return to shop). Fixes the current bug that preserves `existing` assignments when the picker is cleared. |
| **Remove from vehicle page** | Same as return-to-shop for that vehicle’s held quantity; clean orphaned assignment rows. |
| **Delete global catalog item** | Delete the equipment document; all assignments disappear with it. |
| **Delete vehicle — return stock** | Strip that vehicle’s assignments from all equipment; recalculate `availableQuantity`. Default-safe option. |
| **Delete vehicle — delete associated equipment** | For each catalog item: if its **only** remaining assignment was this vehicle (and no other vehicles hold it), delete the catalog record; otherwise only remove this vehicle’s assignment. UI copy must state this clearly. |

Vehicle delete UI: confirmation modal on the **Vehicles list** delete action with the two options above.

QR scan flows (`EquipmentScanClient`) continue to call transfer APIs; return-to-shop must be supported for single and bulk quantities the same way as vehicle↔vehicle transfers.

### 2.4 Per-vehicle required quantity

Managers can set `requiredQuantity` on a vehicle’s assignment (vehicle detail and/or equipment edit when a vehicle context exists). Low-stock issues compare **actual assigned quantity** (or inspector-reported actual, when captured) vs **requiredQuantity**.

---

## 3. Inspection form

### 3.1 Layout

Refactor `InspectClient` from category tabs / next-prev steps into **one scrollable page**:

- Render categories in configured order.
- Each category: header (title + subtitle) immediately above its questions.
- Keep large tap targets for Pass/Fail, Yes/No, Working/Flagged, etc.

### 3.2 Validation

- On load, **do not** pre-fill `pass` / `yes` / `working`.
- Responses start unset; UI shows unselected state.
- Submit button disabled until every **required** question has an explicit answer.
- Required text questions need non-empty content.
- Flagged / Fail answers still require a problem description before submit (existing rule).
- Submit pipeline unchanged aside from issue typing (Section 4): create inspection, create issues, update vehicle last-inspection fields.

---

## 4. Issue types & quick actions

### 4.1 Issue type

Add to `Issue`:

```ts
export type IssueType =
  | 'stock_low_inventory'
  | 'equipment_replacement'
  | 'needs_repair';
```

Display labels: **Stock / Low Inventory**, **Equipment Replacement**, **Needs Repair**.

**Auto-classify on inspection submit** (best-effort heuristics from question type, flagged value, and notes keywords), then allow **manager override** on the Issues view.

### 4.2 Quick actions (manager Issues view)

Primarily for `stock_low_inventory` when `equipmentId` + `vehicleId` are present:

| Action | Effect |
|--------|--------|
| **Update Stock** | Set the vehicle assignment `quantity` to the reported actual. If actual is less than current held, surplus returns to shop; if actual is greater than held, pull the difference from shop (error if shop lacks stock). Prompt for actual if not stored on the issue. Then mark issue `fixed` with resolution notes. |
| **Remove from Van** | Return that vehicle’s held quantity (or a prompted amount) to shop; mark issue `fixed` with resolution notes. |

Both are a single user gesture that performs inventory mutation + status/resolution update. If equipment link is missing, show a clear warning and do not partially resolve.

Structured fields on `Issue` (set when creating from inspection when known):

- `reportedQuantity?: number` — actual count from inspection when available  
- `requiredQuantity?: number` — snapshot of par at report time  

---

## 5. Recent inspectors

### 5.1 Definition

“Who used it last” = people who **completed an inspection** on that vehicle, most recent first (from `inspections` ordered by `submittedAt`).

### 5.2 Placement

- **Issue detail** (Issues page expanded/selected issue).
- **Vehicle detail** history section.

### 5.3 Manager setting

Persisted via a small `AppSettings` record in `dbService` (Settings page control):

- `recentInspectorsDepth: 1 | 3` (default **3**).

UI shows up to N entries: name, date/time, inspection status.

---

## 6. Testing

### 6.1 Tooling

- Add **Vitest** + **jsdom** (no Jest; none configured today).
- Unit/integration tests against `dbService` with isolated localStorage; no Playwright in this pass.

### 6.2 Required cases

1. Reusable equipment with `totalQuantity: 5` — assign/return across shop and vehicles keeps totals accurate; multi-qty assign (>1) succeeds when shop has stock.
2. Assign to vehicle then return to In Shop — central `availableQuantity` and assignment lists update correctly.
3. Transfer helpers used by QR flows — single and bulk quantities to vehicle and back to shop.
4. Global catalog delete removes the item; vehicle delete “return stock” vs “delete associated equipment” behave per Section 2.3.

### 6.3 Error handling

Invalid quantity, insufficient stock, missing vehicle/equipment → throw clear errors; UI surfaces via existing alert pattern. Quick actions refuse unsafe partial updates.

---

## 7. Components & touchpoints

| Area | Primary files |
|------|----------------|
| Inventory APIs | `src/lib/db.ts`, `src/types/index.ts` |
| Catalog / In Shop fix | `src/app/equipment/page.tsx` |
| Vehicle assign/remove | `src/app/vehicles/detail/VehicleDetailClient.tsx` |
| Vehicle delete modal | `src/app/vehicles/page.tsx` |
| QR transfers | `src/app/equipment/scan/EquipmentScanClient.tsx` |
| Inspection form | `src/app/inspect/InspectClient.tsx` |
| Issues + quick actions | `src/app/issues/page.tsx`, issue status helpers in `db.ts` |
| Recent inspectors + setting | Issues UI, Vehicle detail, `src/app/settings/page.tsx` |
| Tests | `src/lib/__tests__/…` or `src/lib/*.test.ts`, Vitest config |

---

## 8. Out of scope

- Migrating to a normalized `vehicle_equipment` Firestore collection.
- Full browser E2E (Playwright/Cypress).
- Dashboard visual redesign.
- Changing auth / passcode / role model.

---

## 9. Success criteria

- Re-assigning / returning stock to In Shop persists and updates global unassigned counts.
- Managers can assign more than one unit to a vehicle when stock allows.
- Vehicle delete offers return-vs-delete-equipment and behaves as specified.
- Inspection is one page; submit blocked until required questions are answered explicitly.
- Issues carry types; Stock issues expose Update Stock / Remove from Van quick actions that sync inventory and resolve.
- Issue and vehicle detail show last 1 or 3 inspectors per manager setting.
- Vitest suite covers the inventory cases listed above.
