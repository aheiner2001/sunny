# Manager Quick Vehicle Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give managers a fast vehicle assignment and switch action, with time-aware history and optional on-behalf inspections.

**Architecture:** Keep current occupancy on `Vehicle` for existing screens and add a dedicated assignment interval ledger. A focused transition helper validates time and closes conflicting intervals; `dbService` persists its result and projects it into current vehicles. The vehicle page exposes the manager action and history; inspections gain separate subject and submitter attribution.

**Tech Stack:** Next.js 14 static export, TypeScript, React, Vitest, localStorage, optional Firestore.

**Spec:** `docs/superpowers/specs/2026-09-23-truck-assign-design.md`

## Global Constraints

- Manager assignment must not create an inspection.
- One current employee per van and one current van per employee.
- Preserve actual recording time separately from editable effective start time.
- Do not silently change old inspection authors or overwrite conflicting history.
- Current app roles are client-side; do not claim server-enforced authorization.

## Review Focus

- A manager backdating earlier than the current interval must see a validation error, not inverted times (Task 1).
- A manager assigning the same employee to the same van twice must not duplicate an open interval (Task 1).
- Two vans referencing one employee after a switch must resolve to one active interval (Task 2).
- A Firestore snapshot arriving after local edits must not duplicate migrated intervals (Task 2).
- Submitting an on-behalf inspection must not switch occupancy to its submitter (Task 4).

---

## File map

- `src/types/index.ts`: assignment record and optional inspection submitter fields.
- `src/lib/vehicleAssignments.ts`: pure transition and validation logic.
- `src/lib/__tests__/vehicleAssignments.test.ts`: interval and overlap cases.
- `src/lib/db.ts`: local and Firestore persistence, checkout/check-in integration, migration.
- `src/lib/__tests__/dbVehicleAssignments.test.ts`: persistence, cross-van changes, migration and non-inspection behavior.
- `src/app/vehicles/detail/VehicleDetailClient.tsx`: manager form, current driver, history and optional inspection link.
- `src/app/inspect/InspectClient.tsx`: manager subject picker and submitter identity.
- `src/app/inspections/page.tsx`: inspection subject and submitter labels.
- `src/lib/__tests__/inspectionAttribution.test.ts`: on-behalf attribution and occupancy.

### Task 1: Assignment interval transitions

**Files:** Modify `src/types/index.ts`; create `src/lib/vehicleAssignments.ts`; create `src/lib/__tests__/vehicleAssignments.test.ts`.

**Interfaces:** Produce `VehicleAssignment {id, vehicleId, vehicleNumber, userId, userName, startedAt, endedAt, source, actorId, actorName, recordedAt}` and `transitionAssignment(assignments, vehicles, request): {assignments, vehicles}`. Request supplies `vehicleId`, optional `user`, effective ISO time, source and actor. An absent user releases the van.

- [ ] **Step 1: Write failing tests** for free-van assignment, occupied-van replacement, employee moving from another van, release, duplicate no-op, invalid timestamp and retroactive overlap. Use exact intervals and assert both closed `endedAt` and one open interval; test that `recordedAt` remains the real recording time.
- [ ] **Step 2: Run** `npm test -- src/lib/__tests__/vehicleAssignments.test.ts`; expect failures for missing transition function.
- [ ] **Step 3: Implement** `transitionAssignment`: parse a valid effective timestamp; locate open intervals by vehicle and employee; reject an effective time earlier than any interval it would close; reject any overlap with closed intervals for either resource; close affected intervals at that time; add a new UUID interval when assigning; derive updated vehicles with `checkInFields` and `checkOutFields(vehicle, user, new Date(effectiveAt))`. Preserve maintenance status and reject assignment to inactive vehicles. Return original arrays on an identical active assignment.
- [ ] **Step 4: Run** `npm test -- src/lib/__tests__/vehicleAssignments.test.ts`; expect pass, then `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `git add src/types/index.ts src/lib/vehicleAssignments.ts src/lib/__tests__/vehicleAssignments.test.ts && git commit -m "Add vehicle assignment transition model"`.

### Task 2: Persistence and all occupancy entry points

**Files:** Modify `src/lib/db.ts`; create `src/lib/__tests__/dbVehicleAssignments.test.ts`; adjust existing occupancy tests if their expected assignment history changes.

**Interfaces:** Produce `dbService.getVehicleAssignments(vehicleId?: string): VehicleAssignment[]`, `dbService.assignVehicle(vehicleId, userId, effectiveAt, actor): Promise<Vehicle>`, and `dbService.releaseVehicle(vehicleId, effectiveAt, actor): Promise<Vehicle>`. Existing `checkOutVehicle` and `checkInVehicle` remain public but call the same transition path.

- [ ] **Step 1: Write failing tests**: manager assign with no new inspection, switch from A to B closes both affected intervals, release closes an interval, existing employee takeover records history, and repeated migration produces one interval with stable ID. Include the case where a snapshot follows a local write and history is deduplicated by ID.
- [ ] **Step 2: Run** `npm test -- src/lib/__tests__/dbVehicleAssignments.test.ts`; expect missing methods/history failures.
- [ ] **Step 3: Implement** the `VEHICLE_ASSIGNMENTS` cache key, `getVehicleAssignments`, dedicated Firestore `vehicleAssignments` listener, and initial migration for occupied vehicles using a deterministic ID such as `legacy-${vehicle.id}-${vehicle.currentUserStartAt || 'unknown'}`. Add one service path calling `transitionAssignment`, writing changed vehicles and intervals locally before dispatching `sunny_db_update`, then syncing changed documents with Firestore `writeBatch` when configured. Route checkout, check-in, return-all and overnight reconciliation through this path; retain the missed-return calculation before clearing stale vans. Validate the active employee and manager actor from `getUsers`/session rather than trusting selected display names. Do not enable assignment of inactive employees.
- [ ] **Step 4: Run** `npm test -- src/lib/__tests__/dbVehicleAssignments.test.ts src/lib/returnAllInUseVehicles.test.ts` and `npx tsc --noEmit`; expect pass.
- [ ] **Step 5: Commit** `git add src/lib/db.ts src/lib/__tests__/dbVehicleAssignments.test.ts src/lib/returnAllInUseVehicles.test.ts && git commit -m "Persist vehicle assignment history across occupancy paths"`.

### Task 3: Manager action and vehicle timeline

**Files:** Modify `src/app/vehicles/detail/VehicleDetailClient.tsx`; optionally create `src/components/VehicleAssignmentDialog.tsx` if the existing detail component becomes harder to read.

**Interfaces:** Consume `getVehicleAssignments`, `assignVehicle`, `releaseVehicle`, current authenticated manager, and active users from `dbService`.

- [ ] **Step 1: Add a focused UI test** in `src/app/vehicles/detail/__tests__/assignment.test.tsx` with mocked `dbService`: opening the form, selecting an employee, editing a start time, confirming an affected prior van, then calling `assignVehicle` without calling `saveInspection`; assert a non-manager cannot see actions.
- [ ] **Step 2: Run** `npm test -- src/app/vehicles/detail/__tests__/assignment.test.tsx`; expect failure before the controls exist.
- [ ] **Step 3: Add** manager-only **Assign / Switch employee** and **Release van** actions beside current occupancy; default the `datetime-local` input to the current local time, convert it to ISO on save, list only active employees, show conflicting active vehicle before confirm, show validation errors in the form, and refresh occupancy/history after save. Include assignment intervals in the timeline alongside inspections and issues. Display `startedAt`, `endedAt`, `actorName`, and a visible marker when a manager backdated the start.
- [ ] **Step 4: Run** the UI test, `npx tsc --noEmit`, and `npm run build`; expect pass.
- [ ] **Step 5: Commit** the UI files with message `Add manager quick assignment to vehicle detail`.

### Task 4: Optional on-behalf inspection attribution

**Files:** Modify `src/types/index.ts`, `src/app/inspect/InspectClient.tsx`, `src/lib/db.ts`, `src/app/inspections/page.tsx`, `src/app/vehicles/detail/VehicleDetailClient.tsx`; create `src/lib/__tests__/inspectionAttribution.test.ts`.

**Interfaces:** An `Inspection` keeps `userId/userName` as the inspected employee and adds `submittedById/submittedByName` as the actual submitter. `dbService.saveInspection` accepts both identities and uses the employee for occupancy when a vehicle is free.

- [ ] **Step 1: Write failing tests**: manager inspects for employee and the resulting record shows both people; manager submitter never becomes current occupant; normal employee submission records the same identity twice; a legacy record without submitter displays the old inspector as both. Assert the on-behalf option is unavailable to an employee.
- [ ] **Step 2: Run** `npm test -- src/lib/__tests__/inspectionAttribution.test.ts`; expect missing submitter fields and behavior failures.
- [ ] **Step 3: Add** a manager-only employee selector to the existing inspection form, defaulting to the current occupant when present. Pass selected subject and authenticated submitter separately to `saveInspection`, preserving existing issue attribution conventions or labeling issue reporter with the actual submitter where applicable. Use subject identity for any free-van checkout and leave an occupied van unchanged. Display both names in inspection detail and the vehicle timeline; older records fall back to `userName`.
- [ ] **Step 4: Run** `npm test -- src/lib/__tests__/inspectionAttribution.test.ts`, `npm test`, `npx tsc --noEmit`, and `npm run build`; expect pass.
- [ ] **Step 5: Commit** the changed files with message `Record inspection subject and submitter separately`.

### Task 5: Final verification

**Files:** Update `PROJECT_INDEX.md` for new assignment storage and UI, if its listed routes still match the implementation.

- [ ] **Step 1: Run** `npm test`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`; capture actual results.
- [ ] **Step 2: Manually exercise** assigning a free van, switching between occupied vans, backdating a valid start, rejecting an overlap, releasing a van, and submitting an on-behalf inspection in the local app. Confirm no inspection record appears on assignment alone.
- [ ] **Step 3: Commit** any index update or verified fix, then provide a branch comparison and any unresolved permission or synchronization limitations. Do not merge or deploy automatically.
