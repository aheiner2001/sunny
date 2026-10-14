# Sunny Fleet Timesheets — Design Specification

**Date:** 2026-10-14  
**Status:** Approved  
**Branch:** `timesheet-branch`  
**Page Route:** `/timesheets`  
**Reference Spec:** `docs/timesheets/timesheet-spec.json`

---

## 1. Executive Summary & Goals

The Sunny Fleet Timesheets module introduces an isolated, production-grade TypeScript timesheet prototype directly within the Sunny application. It provides:
1. **Automated QR-Linked Punching:** Starts clock-in upon vehicle QR scan by authenticated employees before initial inspection, and clocks out automatically upon successful return-checklist submission.
2. **Trainee & Exception Manual Punching:** Dedicated "Clock In" and "Clock Out" controls on the Timesheets page to support trainees and shop workers who do not drive or scan vehicle checklists.
3. **Manager Review & Individual Shift Approvals:** Review, inline correction (with mandatory explanation), approval, amendment, and return-for-correction flows with optimistic concurrency control.
4. **Weekly Summaries & Accurate Time Calculations:** Distinct tracking of approved vs pending hours, explicit unpaid break deductions, cross-week proportional allocations, and DST-safe calculations using Luxon in `America/Denver`.
5. **Zero-Regression & Prototype Isolation:** Comprehensive Vitest coverage ($\ge 80\%$ on all metrics), full preservation of existing fleet tests, and synthetic/test environment isolation preventing any modification to production Firebase collections.

---

## 2. Architecture & File Structure

Following the approved modular architecture, timesheet domain logic, services, and calculations reside under `src/lib/timesheets/`:

```
sunny/
├── docs/
│   ├── timesheets/
│   │   └── timesheet-spec.json
│   └── superpowers/specs/
│       └── 2026-10-14-timesheet-design.md
├── src/
│   ├── app/
│   │   ├── scan/page.tsx                     # QR scan triggers clockIn on start
│   │   ├── return/ReturnClient.tsx           # Return submission triggers clockOut
│   │   └── timesheets/
│   │       ├── page.tsx                      # Route entry & metadata
│   │       └── TimesheetsClient.tsx          # Adaptive employee/manager UI
│   ├── lib/
│   │   ├── navItems.ts                       # Navigation item with Clock icon
│   │   └── timesheets/
│   │       ├── types.ts                      # Interfaces, enums & data contracts
│   │       ├── timeCalculations.ts           # Pure Luxon boundary & split logic
│   │       ├── timesheetStore.ts             # Storage adapter (isolated synthetic / Firestore)
│   │       ├── timesheetService.ts           # Shared capture, concurrency & review API
│   │       └── __tests__/
│   │           ├── timeCalculations.test.ts  # Math, DST, cross-week, constraint tests
│   │           ├── timesheetService.test.ts  # Idempotency, guard, audit, revision tests
│   │           └── TimesheetsClient.test.tsx # UI view-state, cards, modal tests
```

---

## 3. Data Models & Contracts (`src/lib/timesheets/types.ts`)

### 3.1 ShiftRecord
```typescript
export type ShiftStatus = 'active' | 'pending' | 'needs_correction' | 'approved';
export type PunchSource = 'qr' | 'manual' | 'checklist_return';

export interface ShiftRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  locationId: string; // Default: 'loc-main'
  status: ShiftStatus;
  timeZone: string; // 'America/Denver'
  startAtUtc: string; // ISO 8601 UTC
  endAtUtc: string | null; // ISO 8601 UTC; null when status === 'active'
  unpaidBreakSeconds: number; // Explicit duration in seconds; default: 0
  startSource: PunchSource;
  endSource: PunchSource | null;
  startEventId: string; // Stable UUID for idempotency
  endEventId: string | null;
  revision: number; // Monotonically increasing revision integer
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null; // Manager user ID
  managerNote?: string; // Reason or feedback from reviewer
}
```

### 3.2 CorrectionRequest
```typescript
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface CorrectionRequest {
  id: string;
  shiftId: string | null; // null for missing hours request
  employeeId: string;
  employeeName: string;
  proposedStart: string; // ISO UTC
  proposedEnd: string; // ISO UTC
  proposedBreakSeconds: number;
  timeZone: string;
  reason: string; // Required explanation
  status: CorrectionStatus;
  baseRevision: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}
```

### 3.3 AuditEvent
```typescript
export type AuditAction = 
  | 'clock_in' 
  | 'clock_out' 
  | 'request_correction' 
  | 'manager_edit' 
  | 'approve' 
  | 'amend_approve' 
  | 'return_for_correction';

export interface AuditEvent {
  id: string;
  shiftId: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  beforeValues: Partial<ShiftRecord> | null;
  afterValues: Partial<ShiftRecord>;
  reason: string | null;
  revision: number;
  eventId: string;
  timestamp: string; // ISO UTC
}
```

### 3.4 ActiveShiftGuard
```typescript
export interface ActiveShiftGuard {
  employeeId: string;
  activeShiftId: string | null;
  revision: number;
}
```

---

## 4. Time Calculation & Boundary Logic (`timeCalculations.ts`)

1. **Timezone:** Standardized on `America/Denver`. Storage is strictly ISO UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
2. **Net Elapsed Time:**
   $$\text{elapsedSeconds} = \text{diff}(\text{endUtc}, \text{startUtc})$$
   $$\text{netSeconds} = \max(0, \text{elapsedSeconds} - \text{unpaidBreakSeconds})$$
3. **Validation Constraints:**
   - Reject end timestamp $\le$ start timestamp.
   - Reject zero-length shifts.
   - Reject negative breaks or breaks exceeding elapsed duration.
   - Reject overlapping shifts for the same employee:
     $$\text{shift}_1.\text{start} < \text{shift}_2.\text{end} \quad\land\quad \text{shift}_2.\text{start} < \text{shift}_1.\text{end}$$
   - Explicitly permit adjacent shifts sharing an endpoint:
     $$\text{shift}_1.\text{end} = \text{shift}_2.\text{start}$$
4. **DST Transitions:** Luxon calculates physical elapsed hours accurately across daylight saving boundaries:
   - Spring-Forward: 23-hour calendar day calculates actual physical elapsed duration.
   - Fall-Back: 25-hour calendar day calculates actual physical elapsed duration.
5. **Cross-Week Break Allocation:**
   - Week boundaries start on **Monday 00:00:00 local time** (`America/Denver`).
   - If a shift spans across a Monday 00:00:00 boundary, the shift is partitioned into segment 1 (Week A) and segment 2 (Week B).
   - Break allocation is proportional to elapsed duration:
     $$\text{break}_1 = \text{round}\left(\text{unpaidBreak} \times \frac{\text{elapsed}_1}{\text{totalElapsed}}\right), \quad \text{break}_2 = \text{unpaidBreak} - \text{break}_1$$
   - This guarantees that $\text{net}_1 + \text{net}_2 = \text{totalNet}$ without dropping or creating seconds.
6. **Precision & Rounding:** All calculations and aggregations preserve full seconds. Display values round to 2 decimal places ($hh.hh$) exclusively in the UI.

---

## 5. Shared Service & Concurrency Contracts (`timesheetService.ts`)

### 5.1 Clock In (`clockIn`)
* **Signature:** `clockIn(employeeId, employeeName, source, eventId, timestamp?)`
* Checks `ActiveShiftGuard`.
* **Idempotency:** If an active shift already exists, return it with original `startAtUtc`. No secondary shift created.
* If none, create `ShiftRecord` (`status = 'active'`, `startSource = source`, `startEventId = eventId`), set guard, write audit log.

### 5.2 Clock Out (`clockOut`)
* **Signature:** `clockOut(employeeId, source, eventId, unpaidBreakSeconds?, timestamp?)`
* Checks `ActiveShiftGuard`.
* If no active shift, returns error `NO_ACTIVE_SHIFT`.
* If active shift found:
  * Validate `end >= start` and break validity.
  * Update `status = 'pending'`, `endAtUtc = timestamp`, `endSource = source`, `endEventId = eventId`, `unpaidBreakSeconds`.
  * Increment `revision`, clear guard, append audit log.
* **Idempotency:** If already clocked out with `endEventId === eventId`, returns existing closed shift.

### 5.3 Manager Review & Approvals
* **`saveManagerEdit(shiftId, actor, expectedRevision, updates, reason)`**:
  * Asserts `current.revision === expectedRevision` (rejects with `STALE_REVISION_CONFLICT` if out of sync).
  * Requires non-empty `reason`.
  * Updates times/breaks and increments revision; preserves `'pending'` or `'needs_correction'` status without premature approval.
* **`approveShift(shiftId, actor, expectedRevision, updates?, reason?)`**:
  * Asserts `actor.id !== shift.employeeId` (prevents self-approval per prototype default).
  * Asserts `current.revision === expectedRevision`.
  * If adjustments provided (`amend_approve`), requires non-empty `reason`.
  * Sets `status = 'approved'`, `approvedAt = now()`, `approvedBy = actor.id`, increments `revision`, writes audit log.
* **`returnForCorrection(shiftId, actor, expectedRevision, feedbackNote)`**:
  * Requires non-empty `feedbackNote`.
  * Sets `status = 'needs_correction'`, `managerNote = feedbackNote`, increments `revision`, writes audit log.
* **`reviewCorrectionRequest(requestId, actor, decision, reviewNote)`**:
  * If approved: creates or updates the shift to `'approved'` atomically with audit log.
  * If rejected: records rejection note on request.

---

## 6. Integration Points

### 6.1 QR Vehicle Scan (`src/app/scan/page.tsx`)
* When an authenticated employee decodes a valid vehicle QR, invoke `timesheetService.clockIn(...)` before redirecting to `/inspect`.
* Unauthenticated scans force login first; no retroactive unauthenticated timestamps.
* Managers viewing vehicles or general page navigations never clock in.

### 6.2 Return Inspection (`src/app/return/ReturnClient.tsx`)
* After `dbService.submitReturnInspection(...)` succeeds, invoke `timesheetService.clockOut(..., 'checklist_return', ...)`.
* **Resilience:**
  * If `NO_ACTIVE_SHIFT` returned: return inspection remains safely persisted; UI alerts driver that return was recorded and provides a 1-tap route to `/timesheets` to submit a Missing Hours Request.
  * If clock-out fails due to network/storage: inspection remains saved; banner displays retry button for clock-out without duplicating inspection data.

### 6.3 Trainee / Manual Operations (`/timesheets`)
* Trainees clock in/out via prominent buttons on the Timesheets page, utilizing the exact same service and active shift guards.

---

## 7. UI / UX Design (`src/app/timesheets/`)

### 7.1 Employee View
* **Live Punch Status Banner:**
  * Active shift: Green badge with pulsing dot, live ticking elapsed counter (`HH:MM:SS`), start time, and "Clock Out" button (with break input modal).
  * Clocked out: Neutral card with "Clock In" button.
* **Weekly Summary Cards:**
  * Approved Hours (finalized)
  * Pending Hours (submitted / awaiting review)
  * Action Items (e.g., returned shifts needing correction)
* **Week Selector:** Navigation buttons for `< Previous Week`, `This Week`, `Next Week >` with local date labels.
* **Shift Ledger:** Clean table on desktop, card layout on mobile. Displays date, start, end, break, net hours, source icon (`QR` or `Manual`), and status badge.
* **Correction Modals:**
  * "Request Missing Hours": date picker, start time, end time, break duration, and required reason field.
  * "Request Shift Correction": prefilled with current values for corrections.

### 7.2 Manager Review View
* **Filter Toolbar:** Week picker, Employee dropdown ("All Employees" or individual), Status filter.
* **Team Summary Bar:** Total team approved hours vs pending hours for the week.
* **Shift Review Table / Cards:** Full team shifts with attention highlights (overnight shifts, edits, manual trainee punches).
* **Review Drawer / Modal:**
  * Compares original punch vs proposed values.
  * Chronological immutable audit history log.
  * Actions: "Approve Shift", "Save Adjustments", "Return for Correction", "Amend Approved Shift".
  * Disables approval with a warning if the manager attempts to approve their own shift.

---

## 8. Quality Gates & Test Matrix

* **Existing Tests:** All 56 existing test files (398 tests) pass with 0 regressions.
* **Code Coverage:** $\ge 80\%$ on Lines, Branches, Functions, and Statements for all new files under `src/lib/timesheets/` and `src/app/timesheets/`.
* **Test Suites:**
  1. `src/lib/timesheets/__tests__/timeCalculations.test.ts`: 15+ unit tests covering net duration, invalid bounds, overlap rejection, adjacent boundary allowance, DST spring-forward/fall-back, cross-week proportional break splits.
  2. `src/lib/timesheets/__tests__/timesheetService.test.ts`: 15+ integration tests covering clock-in idempotency, repeated scan protection, clock-out without active shift, optimistic concurrency (`STALE_REVISION_CONFLICT`), self-approval blocking, audit log completeness, and correction approvals.
  3. `src/app/timesheets/__tests__/TimesheetsClient.test.tsx`: Component tests covering employee punch display, manager filtering, review drawer interactions, and trainee manual actions.

---

## 9. Prototype Isolation & Delivery

* **Storage Isolation:** The prototype uses an in-memory/localStorage synthetic storage provider (`timesheetStore.ts`) by default when running locally or in preview, ensuring production Firebase collections are never written to.
* **Prototype Indicator:** A noticeable header badge `"Timesheet Prototype (Isolated Test Environment)"` appears on `/timesheets`.
* **Delivery:** Branch `timesheet-branch`, spec at `docs/timesheets/timesheet-spec.json`, full walkthrough and test execution reports.
