# Timesheet & Inspection Pre-Flight Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace automatic silent clock-in on `/inspect` with explicit pre-flight action choices ("Clock In & Start Inspection" vs "Clock In Only (No Inspection)"), and add direct "Clock Out Only (No Inspection)" on `/return`.

**Architecture:**
1. In `InspectClient.tsx`, eliminate the silent mount `useEffect` that calls `timesheetService.clockIn`. Introduce an explicit pre-flight card for employees before the checklist is shown.
2. In `InspectClient.tsx`, offer two actions for unclocked employees: "Clock In & Start Inspection" and "Clock In Only (No Inspection)" (routing to `/timesheets`). If already clocked in, provide "Start Inspection".
3. In `ReturnClient.tsx`, offer a direct "Clock Out Only (No Inspection)" action for employees with an active shift (e.g. trainees, ride-alongs, shop workers, or drivers without vehicles).
4. Update inspection tests and return tests to verify the new explicit flows and guarantee no accidental open shifts occur.

**Tech Stack:** Next.js (App Router), React, TypeScript, Vitest, Testing Library.

---

### Task 1: Inspect Pre-Flight Actions in `InspectClient.tsx`

**Files:**
- Modify: `src/app/inspect/InspectClient.tsx`
- Modify / Add: `src/app/inspect/directClockIn.test.tsx`
- Modify: `src/app/inspect/inspectionTimesheetIndependence.test.tsx`

- [ ] **Step 1: Check active shift and remove mount auto-clock-in in `InspectClient.tsx`**
  - Add `activeShift` state check using `timesheetStore.getActiveShiftGuard(user.id)`.
  - Add `inspectionStarted` state (initialized to `false` for employees unless a draft already exists in `localStorage` or `mode === 'manager'`).
  - Replace the background `useEffect` that auto-clocked in with an explicit `handleClockInAndStart()` and `handleClockInOnly()`.

- [ ] **Step 2: Render pre-flight vehicle card when `!inspectionStarted`**
  - Show vehicle number and name.
  - If `activeShift`:
    - Show badge / message: "Active shift started at [Time]".
    - Primary button: "Start Inspection".
  - If `!activeShift`:
    - Primary button: "Clock In & Start Inspection" (initiates shift and opens form).
    - Secondary button: "Clock In Only (No Inspection)" (initiates shift and pushes to `/timesheets`).
      - Helper text: "Training, ride-along, shop, or other non-driver work".

- [ ] **Step 3: Update `directClockIn.test.tsx` and `inspectionTimesheetIndependence.test.tsx`**
  - Update tests to interact with the explicit pre-flight buttons.
  - Verify that merely loading `/inspect` does NOT call `timesheetService.clockIn`.
  - Verify that clicking "Clock In & Start Inspection" calls `clockIn` and unlocks the inspection checklist.
  - Verify that clicking "Clock In Only (No Inspection)" calls `clockIn` and redirects to `/timesheets`.

---

### Task 2: Shop Exit & Return Direct Clock-Out in `ReturnClient.tsx`

**Files:**
- Modify: `src/app/return/ReturnClient.tsx`
- Modify: `src/app/return/__tests__/returnClockOut.test.ts`

- [ ] **Step 1: Detect active shift on `/return`**
  - Check `timesheetStore.getActiveShiftGuard(user.id)` to determine if user has an active shift.
  - Provide a standalone "Clock Out Only (No Inspection)" button for employees with an active shift:
    - Helper text: "Not driving or no vehicle to return".
    - Calls `timesheetService.clockOut(user.id, 'qr', 'return-direct-...')`.
    - Shows the clock-out success notice and options to visit Home or Timesheets.

- [ ] **Step 2: Add integration tests in `returnClockOut.test.ts`**
  - Test clicking "Clock Out Only (No Inspection)" ends the active shift without requiring a vehicle or checklist answers.
  - Verify shift transitions to `pending` status with proper clock-out confirmation.

---

### Task 3: Full Verification, Commit & Push

- [ ] **Step 1: Run complete test suite and TypeScript check**
  - Run `npm test -- --run`
  - Run `npm run build`
- [ ] **Step 2: Commit and push branch to GitHub**
  - Branch: `timesheet_improvement`
  - Push: `git push -u origin timesheet_improvement`
