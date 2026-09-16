# Sunny Settings, Flags, Jobs & Damage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Split OK:** Tracks A–E are independent enough for parallel agents after Task 1 types/helpers land. Do not start Track E Storage (Track F) in this plan.

**Goal:** Fix Settings category id collisions and unsafe delete; add checkbox answers; wire shop-exit jobs into lifespan; surface van needs on dashboard/detail; add v1 vehicle damage capture/review using data URLs.

**Architecture:** Pure helpers for category id/repair and damage events; `dbService` persists checklist config, jobs, issues, and damage logs; Settings/Inspect/Return/Dashboard/Vehicle detail consume those APIs. Photos stay compressed JPEG data URLs (no Firebase Storage in this plan).

**Tech Stack:** Next.js 14 App Router (`output: 'export'`), TypeScript, Tailwind, Vitest + jsdom, localStorage + optional Firestore via `dbService`.

**Spec:** `docs/superpowers/specs/2026-09-16-sunny-settings-flags-jobs-damage-design.md`

## Global Constraints

- Respect `BASE_PATH` / `asset()`.
- Photos: compressed JPEG data URLs only — no Firebase Storage in this plan.
- Never derive category ids from titles; use stable unique ids (`cat-${Date.now()}-…` or uuid).
- Checklist saves must merge from `getChecklistConfig()` so `returnQuestions` / odometer flags are not dropped.
- Do not steal van occupancy; shop-exit return already uses `submitReturnInspection`.
- TDD for lib helpers and db behavior; `npx vitest run <file>` and `npx tsc --noEmit`.
- Frequent commits; do not commit `tsconfig.tsbuildinfo`.
- Work on a feature branch off current line (`feat/shop-exit-return` or fresh branch from `main` if shop-exit already merged).

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/checklistCategories.ts` | Unique id minting, duplicate repair, delete-move/delete-questions pure helpers |
| `src/lib/checklistCategories.test.ts` | Unit tests for those helpers |
| `src/lib/db.ts` | Normalize categories on read; safe delete API; damage CRUD; ensure inspect flags create issues |
| `src/app/settings/page.tsx` | Create/edit with unique ids; delete modal (move vs delete); checkbox in question modal |
| `src/app/inspect/InspectClient.tsx` | Render checkbox; multi-photo damage step if wired here |
| `src/app/inspect/inspectionValidation.ts` | Required checkbox = must be checked |
| `src/app/return/ReturnClient.tsx` | Jobs completed field; checkbox; optional damage hooks |
| `src/types/index.ts` | `VehicleDamageEvent`, `VehicleSide` |
| `src/lib/vehicleDamage.ts` | Pure helpers for damage events / side status |
| `src/lib/vehicleDamage.test.ts` | Unit tests |
| `src/components/VehicleDamagePanel.tsx` | 4-side overview + history for managers |
| `src/app/dashboard/page.tsx` | Van needs list from open issues |
| `src/app/vehicles/detail/VehicleDetailClient.tsx` | Open needs section; embed damage panel |

---

### Task 1: Category helpers (unique ids + repair + delete plans)

**Files:**
- Create: `src/lib/checklistCategories.ts`
- Create: `src/lib/checklistCategories.test.ts`

**Interfaces:**
- Consumes: `ChecklistCategoryConfig`, `ChecklistQuestion` from `@/types`
- Produces:
  - `mintCategoryId(now?: number): string`
  - `repairDuplicateCategoryIds(categories: ChecklistCategoryConfig[]): { categories: ChecklistCategoryConfig[]; changed: boolean }`
  - `planDeleteCategory(args: { categories: ChecklistCategoryConfig[]; questions: ChecklistQuestion[]; catId: string; mode: 'move' | 'delete_questions'; moveToCategoryId?: string }): { categories: ChecklistCategoryConfig[]; questions: ChecklistQuestion[] }`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/checklistCategories.test.ts
import { describe, expect, it } from 'vitest';
import {
  mintCategoryId,
  repairDuplicateCategoryIds,
  planDeleteCategory,
} from './checklistCategories';
import type { ChecklistCategoryConfig, ChecklistQuestion } from '@/types';

const cat = (over: Partial<ChecklistCategoryConfig> = {}): ChecklistCategoryConfig => ({
  id: 'equipment',
  title: 'Equipment',
  subtitle: '',
  order: 1,
  iconName: 'Wrench',
  ...over,
});

const q = (over: Partial<ChecklistQuestion> = {}): ChecklistQuestion => ({
  id: 'q1',
  category: 'equipment',
  text: 'Check tool',
  type: 'checkbox',
  required: true,
  order: 1,
  ...over,
});

describe('mintCategoryId', () => {
  it('returns a stable unique-looking id not derived from a title', () => {
    const a = mintCategoryId(1000);
    const b = mintCategoryId(1001);
    expect(a).toMatch(/^cat-/);
    expect(a).not.toBe(b);
    expect(a.includes('vehicle')).toBe(false);
  });
});

describe('repairDuplicateCategoryIds', () => {
  it('keeps the first id and remints duplicates', () => {
    const { categories, changed } = repairDuplicateCategoryIds([
      cat({ id: 'vehicle_condition', title: 'Vehicle Condition', order: 1 }),
      cat({ id: 'vehicle_condition', title: 'Vehicle Condition Copy', order: 2 }),
    ]);
    expect(changed).toBe(true);
    expect(categories[0].id).toBe('vehicle_condition');
    expect(categories[1].id).not.toBe('vehicle_condition');
    expect(categories[1].id).toMatch(/^cat-/);
  });

  it('is a no-op when ids are unique', () => {
    const { changed } = repairDuplicateCategoryIds([
      cat({ id: 'equipment' }),
      cat({ id: 'supplies', title: 'Supplies', order: 2 }),
    ]);
    expect(changed).toBe(false);
  });
});

describe('planDeleteCategory', () => {
  it('moves questions then removes the category', () => {
    const categories = [
      cat({ id: 'equipment' }),
      cat({ id: 'supplies', title: 'Supplies', order: 2 }),
    ];
    const questions = [q({ category: 'equipment' }), q({ id: 'q2', category: 'supplies' })];
    const next = planDeleteCategory({
      categories,
      questions,
      catId: 'equipment',
      mode: 'move',
      moveToCategoryId: 'supplies',
    });
    expect(next.categories.map(c => c.id)).toEqual(['supplies']);
    expect(next.questions.every(x => x.category === 'supplies')).toBe(true);
    expect(next.questions).toHaveLength(2);
  });

  it('deletes questions in that category', () => {
    const next = planDeleteCategory({
      categories: [cat({ id: 'equipment' }), cat({ id: 'supplies', title: 'Supplies', order: 2 })],
      questions: [q({ category: 'equipment' }), q({ id: 'q2', category: 'supplies' })],
      catId: 'equipment',
      mode: 'delete_questions',
    });
    expect(next.categories.map(c => c.id)).toEqual(['supplies']);
    expect(next.questions).toHaveLength(1);
    expect(next.questions[0].category).toBe('supplies');
  });

  it('throws when moving without a destination or into the deleted id', () => {
    expect(() =>
      planDeleteCategory({
        categories: [cat()],
        questions: [q()],
        catId: 'equipment',
        mode: 'move',
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/checklistCategories.test.ts --reporter=dot`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement helpers**

```ts
// src/lib/checklistCategories.ts
import type { ChecklistCategoryConfig, ChecklistQuestion } from '@/types';

export function mintCategoryId(now = Date.now()): string {
  return `cat-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

export function repairDuplicateCategoryIds(
  categories: ChecklistCategoryConfig[]
): { categories: ChecklistCategoryConfig[]; changed: boolean } {
  const seen = new Set<string>();
  let changed = false;
  const next = categories.map((c) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      return c;
    }
    changed = true;
    const id = mintCategoryId();
    seen.add(id);
    return { ...c, id };
  });
  return { categories: next, changed };
}

export function planDeleteCategory(args: {
  categories: ChecklistCategoryConfig[];
  questions: ChecklistQuestion[];
  catId: string;
  mode: 'move' | 'delete_questions';
  moveToCategoryId?: string;
}): { categories: ChecklistCategoryConfig[]; questions: ChecklistQuestion[] } {
  const { categories, questions, catId, mode, moveToCategoryId } = args;
  if (categories.length <= 1) {
    throw new Error('Cannot delete the last category');
  }
  if (!categories.some((c) => c.id === catId)) {
    throw new Error('Category not found');
  }
  let nextQuestions = questions;
  if (mode === 'move') {
    if (!moveToCategoryId || moveToCategoryId === catId) {
      throw new Error('Pick another category to move questions into');
    }
    if (!categories.some((c) => c.id === moveToCategoryId)) {
      throw new Error('Destination category not found');
    }
    nextQuestions = questions.map((q) =>
      q.category === catId ? { ...q, category: moveToCategoryId } : q
    );
  } else {
    nextQuestions = questions.filter((q) => q.category !== catId);
  }
  return {
    categories: categories.filter((c) => c.id !== catId),
    questions: nextQuestions,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/checklistCategories.test.ts --reporter=dot`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/checklistCategories.ts src/lib/checklistCategories.test.ts
git commit -m "feat: category id minting, repair, and safe delete plans"
```

---

### Task 2: Wire unique ids + repair + safe delete into Settings/db

**Files:**
- Modify: `src/lib/db.ts` (`getChecklistConfig` normalize; optional `deleteChecklistCategory`)
- Modify: `src/app/settings/page.tsx` (`handleSaveCategory`, `handleDeleteCategory` modal)

**Interfaces:**
- Consumes: helpers from Task 1
- Produces: Settings create never slug-ids; delete modal with move/delete

- [ ] **Step 1: Normalize on read in `getChecklistConfig`**

After parsing config, run `repairDuplicateCategoryIds` on `categories`. If `changed`, persist via `saveChecklistConfig` merging full config (include `returnQuestions`, `collectOdometer`, `collectFuelLevel`).

Also ensure any path that saves categories/questions uses:

```ts
const config = this.getChecklistConfig();
await this.saveChecklistConfig({ ...config, categories, questions });
```

Never hardcode a bare checklist object that drops `returnQuestions`.

- [ ] **Step 2: Fix create id in Settings**

In `handleSaveCategory`, for **new** categories:

```ts
const catId = editingCategory ? editingCategory.id : mintCategoryId();
```

Do **not** use `categoryForm.title.toLowerCase().replace(...)`.

- [ ] **Step 3: Replace `handleDeleteCategory` with a modal**

State: `deleteCategoryTarget: ChecklistCategoryConfig | null`, `deleteMode: 'move' | 'delete_questions'`, `moveToCategoryId: string`.

UI when target set:
- If questions in category: radio Move / Delete questions; if Move, `<select>` of other categories.
- Confirm button calls `planDeleteCategory` then `saveChecklistConfig({ ...getChecklistConfig(), categories, questions })`.
- Block delete when `categories.length <= 1` (disable + hint).

- [ ] **Step 4: Manual check**

Create a category titled exactly like an existing one (e.g. "Vehicle Condition"). Confirm two distinct ids in UI (both editable independently). Delete with move — questions survive under destination.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/app/settings/page.tsx
git commit -m "fix: unique category ids and safe delete with move or wipe"
```

---

### Task 3: Checkbox answer type in Settings + validation + Inspect/Return

**Files:**
- Modify: `src/app/settings/page.tsx` (question type `<option value="checkbox">`)
- Modify: `src/app/inspect/inspectionValidation.ts`
- Modify: `src/app/inspect/inspectionValidation.test.tsx` (or `.ts`)
- Modify: `src/app/inspect/InspectClient.tsx`
- Modify: `src/app/return/ReturnClient.tsx`

**Interfaces:**
- Consumes: existing `QuestionType` including `'checkbox'`
- Produces: checked → `value: 'checked'`

- [ ] **Step 1: Failing validation test**

```ts
it('requires checkbox questions to be checked', () => {
  expect(
    canSubmitInspection(
      [{ id: 'c1', required: true, type: 'checkbox' }],
      { c1: { value: '' } }
    )
  ).toBe(false);
  expect(
    canSubmitInspection(
      [{ id: 'c1', required: true, type: 'checkbox' }],
      { c1: { value: 'checked' } }
    )
  ).toBe(true);
});
```

- [ ] **Step 2: Run test — expect FAIL if checkbox treated as empty string only (may already pass via non-empty check). Adjust implementation so unchecked cannot use a truthy placeholder.**

- [ ] **Step 3: Settings modal**

Add `<option value="checkbox">Checkbox (mark done)</option>` next to other types. `getTypeName` returns `Checkbox`.

- [ ] **Step 4: Inspect + Return UI**

For `q.type === 'checkbox'`:

```tsx
<label className="cluster gap-2 text-sm font-bold">
  <input
    type="checkbox"
    checked={resp?.value === 'checked'}
    onChange={(e) =>
      handleSetResponse(q, e.target.checked ? 'checked' : '', false)
    }
  />
  <span>Done</span>
</label>
```

Mirror in `ReturnClient` with its `setResponse` helper.

- [ ] **Step 5: Run validation tests + tsc**

```bash
npx vitest run src/app/inspect/inspectionValidation.test.tsx --reporter=dot
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx src/app/inspect/inspectionValidation.ts src/app/inspect/inspectionValidation.test.tsx src/app/inspect/InspectClient.tsx src/app/return/ReturnClient.tsx
git commit -m "feat: checkbox answer type in settings, inspect, and return"
```

---

### Task 4: Jobs completed on `/return` → `setVehicleJobsToday`

**Files:**
- Modify: `src/app/return/ReturnClient.tsx`
- Create or extend: `src/lib/missedReturns.test.ts` or `src/lib/returnJobs.test.ts` with db mock pattern from existing missed-return tests

**Interfaces:**
- Consumes: `dbService.getTodayJobsCount`, `dbService.setVehicleJobsToday`, `dbService.submitReturnInspection`
- Produces: jobs field on return submit

- [ ] **Step 1: Failing integration-style test**

Follow `missedReturns.test.ts` firebase mocks. Seed vehicle in use, call a small exported helper or db path:

Prefer implementing submit orchestration in ReturnClient but test db:

```ts
it('setVehicleJobsToday updates day log and lifespan delta', async () => {
  // seed sunny_seeded_v2, one van, one lifespan-enabled equipment assigned
  // await dbService.setVehicleJobsToday('van-1', 3, { id: 'sam', name: 'Sam' });
  // expect getTodayJobsCount('van-1') === 3
  // expect equipment.carsUsed increased by 3 (per existing setVehicleJobsToday rules)
});
```

(If lifespan assignment wiring is heavy, assert day log only in this task and rely on existing `dbLifespan` tests for wear.)

- [ ] **Step 2: ReturnClient UI**

State `jobsCompleted: string` initialized from `dbService.getTodayJobsCount(vehicle.id)` when vehicle resolves.

Show above submit:

```tsx
<label className="block text-xs font-bold uppercase tracking-wider mb-1">
  Jobs completed today
</label>
<input
  type="number"
  min={0}
  step={1}
  value={jobsCompleted}
  onChange={(e) => setJobsCompleted(e.target.value)}
  className="input"
/>
<p className="hint">Updates equipment wear for tools on this van.</p>
```

- [ ] **Step 3: On successful submit, before or after `submitReturnInspection`**

```ts
const jobs = Math.max(0, Math.floor(Number(jobsCompleted) || 0));
await dbService.setVehicleJobsToday(vehicle.id, jobs, {
  id: user.id,
  name: user.name,
});
```

Order: submit return first (clears occupancy), then set jobs (still valid by vehicleId). If `setVehicleJobsToday` requires vehicle present, either order is fine — vehicle remains.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/__tests__/dbLifespan.test.ts src/lib/missedReturns.test.ts --reporter=dot
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/return/ReturnClient.tsx src/lib/returnJobs.test.ts
git commit -m "feat: capture jobs on shop-exit return for lifespan wear"
```

---

### Task 5: Van needs on dashboard + vehicle detail

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/vehicles/detail/VehicleDetailClient.tsx`
- Modify: `src/lib/db.ts` / inspect submit only if flag→issue gap found

**Interfaces:**
- Consumes: `dbService.getIssues()`, existing Issue fields
- Produces: pinned open needs UX

- [ ] **Step 1: Audit inspect → issue creation**

In `InspectClient` submit path, confirm `flaggedIssues` passed into `submitInspection` creates issues. If equipment_status flag skips issue creation, fix in `dbService.submitInspection` so each flagged equipment/item becomes an open Issue with `vehicleId`, `equipmentName`, priority default `moderate` (critical if preset).

- [ ] **Step 2: Dashboard Van needs card**

Below open-issues stat, list up to ~8 open issues grouped by `vehicleNumber`:

```tsx
<div className="card card-pad stack">
  <h2 className="card-title">Van needs</h2>
  {openIssues.length === 0 ? (
    <p className="hint">No open equipment or repair flags.</p>
  ) : (
    openIssues.slice(0, 8).map((iss) => (
      <Link key={iss.id} href={`/issues`} className="spread text-sm">
        <span className="font-bold">{iss.vehicleNumber}</span>
        <span className="text-ink-muted truncate">{iss.equipmentName || iss.title}</span>
      </Link>
    ))
  )}
</div>
```

(Use real Issue field names from `src/types/index.ts` — `title` / `description` / `equipmentName` as present.)

- [ ] **Step 3: Vehicle detail Open needs**

Filter `getIssues()` where `vehicleId === vehicle.id && status !== 'fixed'`. Render list with status badge.

- [ ] **Step 4: Manual** — flag equipment on inspect, confirm dashboard + detail show it.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/vehicles/detail/VehicleDetailClient.tsx src/lib/db.ts src/app/inspect/InspectClient.tsx
git commit -m "feat: pin open van needs on dashboard and vehicle detail"
```

---

### Task 6: Damage types + pure helpers + db CRUD (data URLs)

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/vehicleDamage.ts`
- Create: `src/lib/vehicleDamage.test.ts`
- Modify: `src/lib/db.ts` (`getVehicleDamageEvents`, `addVehicleDamageEvent`, STORAGE_KEYS)

**Interfaces:**
- Produces:

```ts
export type VehicleSide = 'front' | 'rear' | 'left' | 'right';

export interface VehicleDamageEvent {
  id: string;
  vehicleId: string;
  side: VehicleSide | null;
  noNewDamage: boolean;
  note?: string;
  photoDataUrls: string[];
  inspectionId?: string | null;
  userId: string;
  userName: string;
  createdAt: string;
}
```

Helpers:
- `latestStatusBySide(events, vehicleId): Record<VehicleSide, VehicleDamageEvent | null>`
- `assertDamagePayload({ noNewDamage, side, photoDataUrls })` throws if damage reported without side or with >8 photos

- [ ] **Step 1: Failing tests for helpers**

```ts
it('latestStatusBySide returns newest event per side', () => { /* ... */ });
it('rejects damage without side when not noNewDamage', () => { /* ... */ });
```

- [ ] **Step 2: Implement types + helpers + db**

Persist under `localStorage` key e.g. `sunny_vehicle_damage`; optional Firestore collection `vehicleDamage` mirroring other entities. Cap photos at 8; rely on caller to compress.

- [ ] **Step 3: Tests PASS + commit**

```bash
git add src/types/index.ts src/lib/vehicleDamage.ts src/lib/vehicleDamage.test.ts src/lib/db.ts
git commit -m "feat: vehicle damage event model and persistence"
```

---

### Task 7: Damage UI — capture + 4-side panel

**Files:**
- Create: `src/components/VehicleDamageCapture.tsx` (multi-photo, no-new-damage, side select)
- Create: `src/components/VehicleDamagePanel.tsx` (4-side diagram + timeline)
- Modify: `src/app/return/ReturnClient.tsx` and/or `src/app/inspect/InspectClient.tsx` to embed capture on submit
- Modify: `src/app/vehicles/detail/VehicleDetailClient.tsx` to show panel

**Interfaces:**
- Consumes: Task 6 APIs; reuse inspect `processImageFile` pattern (maxDim 800, jpeg 0.8)

- [ ] **Step 1: `VehicleDamageCapture`**

Props: `vehicleId`, `user`, `onRecorded?: (e) => void`.
- Toggle **No new damage** → submit event with `noNewDamage: true`, `side: null`, `photoDataUrls: []`.
- Else: required side select; note optional; multiple file inputs pushing compressed data URLs; Submit → `dbService.addVehicleDamageEvent(...)`.

- [ ] **Step 2: Embed on `/return`** after jobs field (shop-exit is natural for exterior check). Also expose on vehicle detail for manager review only via panel.

- [ ] **Step 3: `VehicleDamagePanel`**

Four clickable regions (front/rear/left/right). Show last event thumb/status. Below: chronological list filtered by selected side or all.

- [ ] **Step 4: Manual** — record damage with 2 photos on left; confirm panel history; record no new damage on front.

- [ ] **Step 5: `npx tsc --noEmit` + relevant vitest

- [ ] **Step 6: Commit**

```bash
git add src/components/VehicleDamageCapture.tsx src/components/VehicleDamagePanel.tsx src/app/return/ReturnClient.tsx src/app/vehicles/detail/VehicleDetailClient.tsx
git commit -m "feat: damage capture and four-side review panel"
```

---

### Task 8: Verification

- [ ] **Step 1:** `npx vitest run src/lib/checklistCategories.test.ts src/lib/vehicleDamage.test.ts src/lib/returnFlow.test.ts src/lib/missedReturns.test.ts src/lib/__tests__/dbLifespan.test.ts src/app/inspect/inspectionValidation.test.tsx --reporter=dot`
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3:** Manual script — category collision create/edit; delete move; checkbox required; return jobs; flag→dashboard; damage photos + 4-side
- [ ] **Step 4:** Push feature branch; open compare/PR URL

---

## Spec coverage check

| Spec track | Tasks |
| --- | --- |
| A Category ids + safe delete | 1–2 |
| B Checkbox | 3 |
| C Return jobs → lifespan | 4 |
| D Van needs / flags | 5 |
| E Damage v1 data URLs | 6–7 |
| F Storage | Out of scope (explicit) |

## Placeholder scan

None intentional. Issue field names in Task 5 must match `Issue` in `src/types/index.ts` at implement time.
