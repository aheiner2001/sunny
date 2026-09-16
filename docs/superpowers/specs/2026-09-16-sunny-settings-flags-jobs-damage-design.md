# Sunny Fleet — Settings integrity, checklist UX, lifespan jobs, damage tracking

**Date:** 2026-09-16  
**Branch target:** feature work off current `feat/shop-exit-return` / `main` as decided at plan time  
**Status:** Design for implementation (multi-agent split OK)

## Goal

Fix Settings category corruption and unsafe delete; add checkbox answers; wire shop-exit jobs into equipment lifespan; tighten equipment-flag → van needs visibility; add a usable vehicle exterior damage review flow **without requiring Firebase Storage on day one**.

## Non-goals

- Payroll / timesheet (parked).
- Replacing Kimai or other time tools.
- Firebase Blaze / Storage upgrade as a blocker for v1 damage (optional later).
- Rewriting the whole inspect flow.

## Context (current product)

- Checklist categories live in `ChecklistConfig` / Settings. Seed ids: `equipment`, `supplies`, `vehicle_condition`, `previous_user_condition`.
- **Bug:** `handleOpenAddCategory` sets `id: cat-${Date.now()}`, but `handleSaveCategory` **ignores** that and uses `title.toLowerCase().replace(/[^a-z0-9]+/g, '_')`. Creating a category whose slug matches an existing id (e.g. “Vehicle Condition” → `vehicle_condition`) produces **duplicate ids**. Edits/map-by-id then look “synced.” New unique titles don’t collide.
- **Delete today:** confirm, then remove category **and** all questions in it.
- `QuestionType` already includes `checkbox`, but Settings modal and inspect/return UIs don’t offer/render it cleanly.
- Issues + dashboard open-issue counts exist; inspect can flag. Per-van “what’s broken / missing” is incomplete (~6/10).
- `setVehicleJobsToday` + lifespan `carsUsed` exist on vehicle detail; return checklist does **not** ask jobs or call that API (~4/10 for manager ask).
- Photos today are compressed JPEG **data URLs** (no Storage). Damage 4-side system does not exist.

## Decomposition (implementation agents)

| Track | Spec section | Priority |
| --- | --- | --- |
| A | Category unique ids + repair + safe delete | P0 |
| B | Checkbox answer type | P1 |
| C | Return jobs → lifespan wear | P1 |
| D | Equipment flag → van needs / dashboard pin | P2 |
| E | Vehicle damage tracking (v1 data URLs) | P2 |
| F | (Optional later) Firebase Storage for damage photos | P3 — not required to start E |

---

## Track A — Category sync bug + safe delete

### Approaches considered

1. **Unique stable ids always** (`cat-${Date.now()}` or uuid); never derive id from title. One-time repair pass dedupes existing collisions. **Recommended.**
2. Keep slug ids but reject create if slug exists — still fragile on rename/import.
3. Only repair localStorage once — doesn’t stop recurrence.

**Decision:** Approach 1.

### Behavior

**Create**

- New category id = stable unique id (`cat-${Date.now()}` or uuid). Never overwrite from title slug.
- Title/subtitle/icon are display-only; renaming does not change id.
- Reject create if title is empty. Allow duplicate *titles* only if product already allows; prefer warn on duplicate title but **never** duplicate id.

**Edit**

- Update only the category whose `id` matches `editingCategory.id`.
- Never remint id on edit.

**Repair (on Settings checklist load / `getChecklistConfig` normalize)**

- If two+ categories share an id: keep first; assign new unique ids to duplicates; remapping is best-effort:
  - Questions still pointing at the shared id stay on the **kept** category (first).
  - Optionally surface a one-time toast: “Fixed duplicate category ids.”
- Deduplicate by id in the saved config after repair.

**Safe delete**

When deleting a category with `qCount > 0`, show a modal (not only `confirm`):

1. **Move questions** → manager picks another **existing** category from a dropdown (exclude the one being deleted). Reassign `question.category` to that id, then remove category.
2. **Delete questions** → remove category and those questions (explicit destructive confirm).

When `qCount === 0`, simple confirm is enough.

If only one category remains, either block delete or require move/delete of questions first — **block deleting the last category** to avoid empty checklist structure.

**Success criteria**

- Creating “Vehicle Condition” again cannot collide with seed `vehicle_condition`.
- Editing one category never changes another’s title/subtitle.
- Delete never silently wipes questions; move path preserves them under the chosen category.
- Vitest covers: unique id on create; collision repair; delete-move; delete-questions.

---

## Track B — Checkbox answer type

### Approaches

1. Wire existing `checkbox` type through Settings + inspect + return. **Recommended.**
2. Add a new type name (`done_check`) — unnecessary duplication.

**Decision:** Approach 1.

### Behavior

- Settings question modal: add option **Checkbox** (“Mark done”).
- Inspect + Return UIs: single control — unchecked / checked. Checked stores `value: 'checked'` (or `'yes'`); unchecked empty for required validation.
- `canSubmitInspection`: required checkbox needs checked state (same as non-empty value).
- Flagging optional: checkboxes are completion marks; no fail/flag by default (keep simple).
- Return checklist and morning checklist both support the type.

**Success criteria**

- Manager can add a required checkbox; driver cannot submit until checked; optional checkbox can be left unchecked.

---

## Track C — Return checklist jobs → lifespan

### Approaches

1. Built-in return field **Jobs completed today** (always present on `/return`, not only a free-text question) that calls `setVehicleJobsToday` on submit. **Recommended.**
2. Magic question id in `returnQuestions` parsed by text — fragile.
3. Only keep vehicle-detail jobs UI — doesn’t meet manager shop-exit ask.

**Decision:** Approach 1.

### Behavior

- On `/return` (and catch-up return), show numeric **Jobs completed** (integer ≥ 0) for the resolved van, prefilled with `getTodayJobsCount(vehicleId)` when available.
- On successful `submitReturnInspection`, call `setVehicleJobsToday(vehicleId, jobs, user)` so lifespan `carsUsed` updates by delta (existing db logic).
- Do not double-apply if manager already set the same count on vehicle detail for that day (set API is absolute count — submit sets the value they entered).
- Copy: explain this updates equipment wear for tools on that van.
- Not required to block return if 0 is valid (empty day). Optional: require confirmation when leaving 0 while van was in use — **skip for v1** (YAGNI).

**Success criteria**

- Completing return with jobs=5 updates today’s vehicle day log and increments lifespan usage by the delta vs previous log.
- Unit/integration test around submit path + `setVehicleJobsToday`.

---

## Track D — Equipment flag → van needs / dashboard pin

### Approaches

1. Tighten existing Issues: ensure inspect `equipment_status` / fail flags create/link issues; dashboard + vehicle detail show open needs pinned. **Recommended.**
2. New parallel “pins” model — duplicate Issues.

**Decision:** Approach 1.

### Behavior

- Inspect flag / equipment not working continues to create Issues (verify path; fix gaps).
- Dashboard: keep open-issue count; add a compact **Van needs** list (open issues grouped by vehicle, link to `/issues` or vehicle detail).
- Vehicle detail: clear **Open needs** section (equipment name, status, priority, link).
- Score target after work: **8+/10** for “manager sees what each van needs.”

**Success criteria**

- Flagging equipment on inspect surfaces on dashboard and that van’s detail without hunting.

---

## Track E — Vehicle damage tracking (v1)

### Approaches

1. **v1 data URLs** in inspection responses + a `VehicleDamageEvent` (or Issue subtype) log with side enum; multi-photo as array of data URLs with size caps. **Recommended to start (no Firebase change).**
2. Firebase Storage first — blocks until Blaze/rules; better long-term for many large photos.
3. Full 3D model — out of scope.

**Decision:** Approach 1 for v1; Approach 2 documented as Track F later.

### Firebase / Storage

- **No Blaze/Storage required for v1.** Continue compressed JPEG data URLs (existing pattern, max dimension ~800).
- Cap: e.g. max 4–8 photos per damage entry; compress before save; warn if payload huge.
- When photo volume or Firestore doc size becomes a problem, do **Track F**: Storage bucket + download URLs, keep same UI.

### Behavior

**Capture (inspect and/or return)**

- Dedicated damage step or question type enhancement:
  - Multi-photo attach (not single only).
  - Quick **No new damage** (sets a clear status, skips photo requirement).
  - **Side:** front | rear | left | right (required if damage reported).

**Review**

- Admin/manager: per-vehicle **Damage** panel — 4-side diagram (simple CSS/SVG boxes, not a 3D car); each side shows latest status + thumbnails; tap opens history.

**History**

- Central log per vehicle: timestamp, side, note, photos, inspector, “no new damage” events optional.
- New marks comparable against prior events on that side.

**Data (v1 sketch)**

```ts
type VehicleSide = 'front' | 'rear' | 'left' | 'right';

interface VehicleDamageEvent {
  id: string;
  vehicleId: string;
  side: VehicleSide | null; // null when noNewDamage
  noNewDamage: boolean;
  note?: string;
  photoDataUrls: string[]; // v1; later photoUrls from Storage
  inspectionId?: string | null;
  userId: string;
  userName: string;
  createdAt: string; // ISO
}
```

**Success criteria**

- Driver can mark no new damage OR attach multiple photos + side.
- Manager sees 4-side overview + timeline per van.
- Works offline/localStorage like rest of app; Firestore sync when configured (same pattern as other collections).

---

## Track F — Firebase Storage (optional later)

Only when v1 photo size/limits hurt:

- Enable Storage on Firebase project (may require Blaze).
- Upload compressed blobs; store download URLs on `VehicleDamageEvent`.
- Migration: leave old data URLs readable.

**Not a prerequisite for Tracks A–E.**

---

## Architecture notes

- Prefer pure helpers + dbService methods + Vitest (TDD for A, C).
- Respect `BASE_PATH` / `asset()`.
- Do not steal occupancy; shop-exit return already clears via `submitReturnInspection`.
- Settings saves must not drop `returnQuestions` / odometer flags when rewriting checklist config (existing bug risk in delete path that rebuilds config with hardcoded id/name — fix to merge from `getChecklistConfig()`).

## Testing

- A: unit tests for id uniqueness, repair, delete-move, delete-questions.
- B: validation + Settings option present.
- C: return submit updates jobs/lifespan delta.
- D: manual + light tests if helpers extracted.
- E: helpers for side/status; manual photo compress path.

## Rollout order for agents

1. A (P0)  
2. B + C (can parallel)  
3. D  
4. E  
5. F only if needed  

## Open decisions (locked by recommendation)

| Topic | Decision |
| --- | --- |
| Move destination on delete | Manager picks another existing category |
| Checkbox semantics | Done mark; required = must check |
| Jobs field | Built-in on `/return`, calls `setVehicleJobsToday` |
| Damage photos v1 | Data URLs; Storage later |
| Firebase change before E? | **No** |

