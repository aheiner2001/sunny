# October 20 branch — timesheets reliability, manager analytics polish, testing

**Branch:** `october-20` (from `origin/main`)  
**Date:** 2026-10-20  
**Status:** Design approved in brainstorming; awaiting implementation plan after user reviews this spec.

## Problem

On the deployed/`main` app, managers and employees see unreliable timesheet cloud sync (“Cloud sync failed… Firebase permissions”), incomplete historical recovery when a return is missing (“no return submitted”), and uncertainty that automatic clock-in/out and manager timesheet visibility actually work. Separately, Manager Analytics under Settings needs a layout and polish pass (overlap/overflow and section clarity) so it reads as a finished tool.

The local working tree had previously been on an older feature branch that lacked timesheets and analytics; work for this effort starts from current `origin/main` on `october-20`.

## Goals

1. Harden timesheet sync UX and prove automatic punch + manager visibility with automated tests.
2. Let managers recover historical hours when a matching return is missing by entering an end time (pending review).
3. Polish Manager Analytics layout and section clarity without rewriting maintenance domain logic.
4. Ship a short testing guide so the owner can run and trust automated checks instead of manually retesting the whole site.
5. Include a Firebase Console rules checklist for timesheet collections.

## Non-goals

- Rebuilding timesheets into fleet `dbService` sync.
- Clock-in at QR scan time (clock-in remains inspection-form entry only).
- Auto-guessed shift length when no return exists.
- Payroll charts on the Manager Analytics page.
- Firebase Storage for inspection photos, BigQuery, or ML.
- Full site-wide Playwright E2E on every PR, or live Firebase in CI.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Branch base | `origin/main` → `october-20` |
| Work order | Timesheets reliability → analytics polish → tests + testing guide |
| Clock-in | Only when the inspection form opens (scan→form or New inspection→vehicle). Scanner alone does not punch. |
| Clock-out | After successful return report submit. |
| Cloud sync scope | App hardening + tests + Firebase Console rules checklist (not assuming Console access from the agent). |
| Historical missing return | Keep `attention` state; manager override: set end time → pending recovered shift → approve/edit as today. |
| Analytics | Fix layout breakage first, then polish each section; keep Sample mode, widget prefs, pinned urgent actions. |
| Approach | Surgical harden + polish on existing architecture (not a rebuild). |

## Architecture

### Timesheets (keep)

```
InspectClient (form mount) → timesheetService.clockIn(..., 'qr', ...)
ReturnClient (after save)  → timesheetService.clockOut(..., 'checklist_return', ...)
TimesheetsClient           → manager/employee review UI + sync status
historicalRecovery*        → estimates from inspection pairs; new override path for attention rows
timesheetStore             → localStorage + Firestore listeners/transactions
```

Collections (unchanged): `timesheet_shifts`, `timesheet_guards`, `timesheet_audit`, `timesheet_corrections`.

Fleet occupancy (`occupancy` / vehicle `currentUser*`) remains separate from payroll punches.

### Manager Analytics (keep)

```
Settings card → /settings/analytics → MaintenanceAnalytics
  widgets: metrics, outlook, vehicles, equipment, timeline, preferences, export
  Sample mode + analyticsPreferences (localStorage per manager)
```

Domain: oil/equipment maintenance planning — not payroll.

## Design details

### 1. Timesheet sync UX

- Keep existing status strings; improve clarity when failure is likely permissions vs offline when the error shape allows.
- Ensure retry paths are obvious from the Timesheets UI when listeners or saves fail.
- Prefer showing cached shifts with an honest sync banner over an empty manager table when local data exists and cloud confirmation failed.
- Do not block inspection or return submission on timesheet success (existing independence remains).

### 2. Automatic punches

- Single clock-in trigger: inspection checklist entry (`InspectClient` mount path already on `main`).
- Clock-out: after successful return inspection save (`ReturnClient`), with existing retry / `NO_ACTIVE_SHIFT` handling that does not fail the return save.
- Automated tests must lock: form entry punches; scanner alone does not; return save clocks out.

### 3. Historical manager override (missing return)

- Rows in `attention` for missing matching return stay visible with a clear reason.
- Manager action: enter end time (and keep existing start basis rules) → create `pending` recovered shift with audit/recovery metadata → appears in manager review like other recoveries.
- No default shift length. Overlap rules still apply (reject or surface conflict if overlapping existing shifts/corrections).
- Extend `historicalRecovery` / `historicalRecoveryService` / `HistoricalHoursRecovery` UI rather than a parallel store.

### 4. Manager Analytics polish

- CSS/layout pass: stacking, sticky/fixed layers, modal z-index, mobile horizontal overflow, timeline scroll containment.
- Each widget: one headline, one short supporting line, primary action clear; reduce clutter without removing features.
- Settings entry card: clearer hierarchy; still links to `/settings/analytics`.
- Preserve Sample mode, reorder/hide prefs, and pinned weekly actions when ordinary widgets are hidden.
- Extend existing layout checks (`scripts/check-manager-analytics.mjs` / component tests) if new containment rules are added.

### 5. Testing and documentation

**Automated (required for this branch):**

| Area | Coverage |
|------|----------|
| Clock-in on inspect entry | Called on form mount |
| Scanner | Does not call clock-in |
| Clock-out on return | After successful return save |
| Historical override | Missing-return row → manager end time → pending recovered shift |
| Sync failure | Mocked listener/save failure surfaces status + retry contract |
| Analytics | Existing suites stay green; add/extend only for layout/polish regressions we introduce |

Commands (document in guide):

- `npm test` — Vitest once  
- `npm run test:watch` — while developing  
- `npm run test:coverage` — optional  
- `npx tsc --noEmit` — types  
- `npm run build` — production build  
- `node scripts/check-manager-analytics.mjs` — analytics layout walkthrough (when used)

**Human doc:** `docs/october-20-testing-guide.md`

Contents:

1. One-command smoke and how to read pass/fail in the terminal  
2. Watch mode and optional coverage  
3. Firebase Console checklist for the four timesheet collections (read/write expectations)  
4. Short manual spot-check (3–5 steps only): inspect clock-in → return clock-out → manager sees shift; analytics at phone width  
5. How to interpret sync banners and historical `attention` vs recovered pending  

Live Firebase is not required in CI; mocks cover app contracts. Console checklist is the ops verification for permissions.

## Error handling

| Case | Behavior |
|------|----------|
| Timesheet cloud listener/save fail | Banner + retry; cache may still show; inspection/return still saves |
| Auth unavailable for punch | Existing auth error status; retry |
| Return with no active shift | Do not fail return; point user to Timesheets |
| Historical override overlap | Reject with clear error; no silent overwrite |
| Analytics Sample mode | No live fleet writes (existing contract) |

## Implementation order

1. Timesheet sync UX + punch path verification/hardening  
2. Historical missing-return manager override  
3. Manager Analytics layout + section polish  
4. New/extended Vitest tests for all changed behaviors  
5. `docs/october-20-testing-guide.md` (including Firebase rules checklist)  
6. Run full `npm test` (+ analytics script / build as needed) and fix regressions  

## Success criteria

- Automatic clock-in/out contracts are enforced by tests the owner can re-run with `npm test`.  
- Managers can recover missing-return historical rows via end-time override into pending review.  
- Sync failures are visible and retryable; Console checklist exists for permissions.  
- Manager Analytics has no obvious overlap/overflow regressions in targeted checks; sections read cleaner.  
- Testing guide explains how to run tests, see results, and do the short manual spot-check.

## Spec self-review notes

- No TBD placeholders left for product decisions.  
- Analytics remains maintenance-only; timesheets remain a separate subsystem.  
- Scope is one branch package but two subsystems sequenced; implementation plan should keep the same order.  
- “Improve analytics a ton” is bounded to layout + section clarity, not domain rewrite.  
