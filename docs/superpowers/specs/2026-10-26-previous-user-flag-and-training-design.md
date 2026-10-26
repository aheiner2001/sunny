# Previous-user flag + training accountability — design

**Branch:** `october-26-changes` (do **not** merge to `main` until owner tests on Vercel)  
**Date:** 2026-10-26  
**Status:** Approved (council recommendations + user approve)

## Goals

1. **Feature A:** Managers mark checklist questions that hold the *previous* truck user accountable. A “No”/issue answer creates flags; on the flagged user’s next QR scan (any truck) they hard-block until Acknowledge; open batch clears.
2. **Feature B:** Training curriculum with deadlines, designated trainers, dual sign-off (trainer then trainee), miss streaks from linked checklist questions, auto-retrain, manager dashboard, append-only proof.
3. **Quality:** Every slice ships with mocked Firestore/`dbService` persistence tests **and** flow/UI tests so the path cannot silently break.

## Non-goals (v1)

- Email / SMS / push for flags or training.
- Per-user custom coaching copy; per-flag message overrides.
- Locking employees out of the app when training is overdue.
- Third login role beyond employee/manager (trainer is a capability flag).

## Feature A — Previous-user flag

### Previous user resolution

1. Prefer the last **ended vehicle assignment** on that truck (prior driver before this handover).  
2. Else the most recent **completed inspection** on that truck whose `userId` ≠ current submitter.  
3. Never flag the submitter themselves. If no prior user → no previous-user flag created (normal issue alerts still apply).

### Question settings

On each `ChecklistQuestion` (pre-trip and return):

- `holdPreviousUserAccountable?: boolean` — Settings label: **“Hold previous user accountable”**
- `previousUserMessage?: string` — default measures/instructions shown on the block screen

Helper copy: if answered in the issue direction (existing `flagCondition`), create a previous-user flag for the prior driver.

### Flag records

Collection (logical): `previousUserFlags` (via `dbService`).

Fields (conceptual): `id`, `employeeId` (flagged user), `vehicleId`, `vehicleNumber`, `questionId`, `questionText`, `inspectionId`, `createdAt`, `createdById`, `message` (snapshot of question message at create time), `status: 'open' | 'acknowledged'`, `acknowledgedAt?`, `batchId?`.

Open flags for an employee form the block list. **Acknowledge** sets all currently open flags for that employee to `acknowledged` (clears the batch). New flags later create a new batch.

### UX

- After QR → before inspect/return proceed: if employee has any `open` flags → full-screen list (truck, item, message) → **Acknowledge** required.
- Optional logged-in banner/badge when open flags exist (in-app only).
- No email/SMS in v1.

### Tests

- Resolve previous user (assignment vs inspection fallback).
- Create flags only when question opted in + issue answer + prior user exists.
- Acknowledge clears open batch; persistence mocked.
- Flow: open flags → scan path blocked → Acknowledge → proceeds.

## Feature B — Training

### Roles

- **Manager:** curriculum, deadlines, assign trainers↔trainees, all stats, thresholds.
- **Designated trainer:** `user.isDesignatedTrainer === true`; v1 can view **all** trainees; sign off items; cannot edit curriculum.
- **Trainee:** any employee in a training assignment; confirms after trainer sign-off.
- Login roles remain `employee` | `manager`.

### Data (conceptual)

- `TrainingItem`: id, title, description, order, deadlineType (`end_of_day` | `within_days`), withinDays?, retrainThreshold (default 2), linkedQuestionIds[], active.
- `TraineeTrainerAssignment`: traineeId, trainerIds[].
- `TrainingAssignment`: traineeId, itemId, status (`assigned` | `awaiting_trainee` | `completed` | `overdue` | `needs_retrain`), dueAt?, missStreak, events[].
- **Events (append-only):** `trainer_signoff`, `trainee_certify`, `miss`, `retrain_required`, `deadline_passed`.

### Dual sign-off

1. Trainer sign-off → status `awaiting_trainee`.  
2. Trainee certify → `completed` (+ immutable pair of events with timestamps and actor ids).  
Retrain cycle = new sign-off + certify; history kept.

### Misses & retrain

- Miss: submitted inspection answer on a **linked** question in the issue direction.
- Consecutive streak until clean pass on that question **or** completed retrain certify.
- If streak ≥ item.retrainThreshold **and** item was previously completed → `needs_retrain`.

### Deadlines

Per item: `end_of_day` or `within_days` from assignment. Overdue → dashboard visibility only (no QR lockout v1).

### Dashboard (manager)

Overdue/incomplete, needs retrain, miss streaks, completion % by item, person→item timeline.

### Tests

- Sign-off/certify persistence and immutability (no overwrite of prior events).
- Miss streak + auto-retrain thresholds.
- Role permission denials for curriculum vs sign-off.
- Flow: assign → trainer signs → trainee certifies → appears completed on dashboard.

## Build order

1. Feature A domain + persistence + Settings + QR gate.  
2. Feature B curriculum + trainer capability + dual sign-off.  
3. Miss/retrain link + manager dashboard.

## Out of branch policy

Push only to `october-26-changes`. Owner merges to `main` after Vercel preview.

## Firebase collections (preview)

Allow authenticated read/write in Console rules for:

- `previousUserFlags`
- `trainingItems`
- `trainingAssignments`
- `traineeTrainers`

Until rules exist, cloud writes fail closed (local state does not claim success when `db` is configured).

## Preview checklist

1. Settings → checklist question → enable **Hold previous user accountable** + message.  
2. Submit an inspection with that item flagged while a prior assignment/inspector exists.  
3. Sign in as the previous user → Scan/Inspect → Acknowledge gate → proceed.  
4. Nav → **Training** → add curriculum item → assign → trainer sign-off → trainee certify.
