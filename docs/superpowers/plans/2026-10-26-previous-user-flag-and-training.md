# Previous-user flag + training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship previous-user accountability on checklist questions and a training dual-sign-off system with miss/retrain and manager visibility on `october-26-changes`.

**Architecture:** Domain modules under `src/lib/` with `dbService`/Firestore persistence; Feature A gates QR→inspect via open flags; Feature B adds Settings/training UI and append-only event logs. Login roles stay employee|manager; trainer is a user capability flag.

**Tech Stack:** Next.js, React, TypeScript, Vitest, existing `dbService` + Firebase patterns.

## Global Constraints

- Branch `october-26-changes` only — never merge to `main`.
- Every slice: mocked persistence tests + flow/UI tests.
- In-app only notifications (no email/SMS v1).
- Spec: `docs/superpowers/specs/2026-10-26-previous-user-flag-and-training-design.md`.

---

## File map

| Area | Files |
|------|--------|
| Types | `src/types/index.ts` |
| A domain | `src/lib/previousUserFlags.ts` (+ `__tests__`) |
| A persistence | `src/lib/db.ts` (or dedicated store) + tests |
| A Settings | checklist editor in `src/app/settings/page.tsx` / question form components |
| A gate UI | `src/app/scan/page.tsx` and/or `InspectClient` / shared `PreviousUserFlagGate.tsx` |
| B domain | `src/lib/training/` (items, assignments, misses) |
| B UI | Settings training tab, training dashboard page, employee certify UI |
| Nav | `src/lib/navItems.ts` as needed |

---

### Task 1: Feature A domain — resolve previous user + create flags

**Files:** `src/lib/previousUserFlags.ts`, `src/lib/__tests__/previousUserFlags.test.ts`, types

- [ ] Write failing tests: assignment preferred; inspection fallback; no self-flag; only when `holdPreviousUserAccountable` + issue answer
- [ ] Implement pure functions `resolvePreviousUser`, `buildPreviousUserFlagsFromInspection`
- [ ] Run tests green
- [ ] Commit

### Task 2: Feature A persistence

**Files:** `db` layer + `src/lib/__tests__/previousUserFlagPersistence.test.ts`

- [ ] Failing tests: save open flags, list open by employee, acknowledge batch, cloud failure does not claim success
- [ ] Implement store methods + Firestore collection wiring following existing checklist/alert patterns
- [ ] Green + commit

### Task 3: Feature A Settings toggle

**Files:** Settings checklist question editor, types on `ChecklistQuestion`

- [ ] Failing UI/unit test for toggle + message field persistence through `saveChecklistConfig`
- [ ] Wire Settings controls
- [ ] Green + commit

### Task 4: Feature A create flags on inspection submit

**Files:** `InspectClient` / `dbService.submitInspection` path

- [ ] Failing test: submit with accountable No creates flag for prior user
- [ ] Hook creation into submit
- [ ] Green + commit

### Task 5: Feature A QR hard-block + Acknowledge flow

**Files:** `PreviousUserFlagGate.tsx`, scan/inspect entry

- [ ] Failing flow test: open flags block → Acknowledge → proceed; batch cleared
- [ ] Implement gate UI
- [ ] Green + commit

### Task 6: Feature B types + curriculum persistence

**Files:** `src/lib/training/*`, Settings training tab scaffold

- [ ] Failing persistence tests for TrainingItem CRUD
- [ ] Implement + manager-only Settings section
- [ ] Green + commit

### Task 7: Feature B trainer capability + dual sign-off

**Files:** employees/user fields, training assignment service, UI

- [ ] Failing tests: trainer sign-off then trainee certify; events append-only; permission denials
- [ ] Implement
- [ ] Green + commit

### Task 8: Feature B misses, retrain, deadlines, dashboard

**Files:** miss hooks from inspection submit, dashboard page

- [ ] Failing tests: streak, threshold→needs_retrain, overdue status, dashboard aggregations
- [ ] Implement + nav entry
- [ ] Green + commit

### Task 9: Branch verification

- [ ] `npx vitest run` for touched areas (widen if stable)
- [ ] Push `october-26-changes` only — do not merge main
