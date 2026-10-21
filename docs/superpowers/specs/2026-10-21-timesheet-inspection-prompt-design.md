# Timesheet & Inspection Improvements — Shift Start/End Actions

**Branch:** `timesheet_improvement`  
**Date:** 2026-10-21  
**Status:** Approved by user  

## Problem

1. **Phantom Shifts / Incomplete Inspections:** Opening `/inspect?id=...` immediately auto-clocked in employees in a background `useEffect`. If an employee (or someone on a shared device) navigated away or closed the tab without submitting, an unclosed active shift was permanently stranded without any inspection record (e.g. Steve's 6:22 PM shift).
2. **Missing Office / Non-Inspection Hours:** Employees arriving early for training, ride-alongs, shop prep, or office tasks had no natural scan flow to clock in without starting a vehicle inspection.
3. **Shop Exit QR Missing Clock-Out Only:** When employees scan the Shop Exit QR code at `/return`, they could only clock out by submitting a vehicle return form. Non-drivers, ride-alongs, or trainees had no way to clock out directly from the exit scan.

## Goals

1. **Explicit Inspection Pre-Flight (Morning / Inspect QR):**
   - Eliminate automatic silent clock-in on page load.
   - When visiting `/inspect?id=...`, display a vehicle pre-flight confirmation:
     - If not clocked in:
       - **"Clock In & Start Inspection"**: Clocks in (source: `'qr'`) and unlocks the inspection checklist.
       - **"Clock In Only (No Inspection)"** (helper: *"Training, ride-along, shop, or other non-driver work"*): Clocks in and navigates directly to the Timesheets page.
     - If already clocked in:
       - Show active shift banner (*"Currently clocked in since [Time]"*).
       - Button: **"Start Inspection"** (unlocks checklist without duplicate clock-in).
2. **Shop Exit QR Direct Clock-Out (Evening / Return QR):**
   - On `/return`, provide a clear option for employees with an active shift:
     - **"Clock Out Only (No Inspection)"** (helper: *"Not driving or no vehicle to return"*).
     - Clocks out the employee immediately and displays the shift summary / link to timesheets.
   - Drivers returning a vehicle continue with the vehicle checklist; submitting it clocks them out at the end as before.

## Non-Goals
- Changing timesheet manager review or approval permissions.
- Changing vehicle assignment algorithms or checklist schema.

## User Flow Specifications

### 1. `/inspect?id=<vehicleId>`
- State: `inspectionStarted: boolean` (default false unless draft exists or previously started in session).
- If `!inspectionStarted` and `user.role === 'employee'`:
  - Show Vehicle Card (`vehicleNumber`, `name`).
  - Active Shift Check:
    - If `activeShift`:
      - Banner: "Active shift started at [Time]".
      - Primary Button: "Start Inspection".
    - If `!activeShift`:
      - Primary Button: "Clock In & Start Inspection".
      - Secondary Button: "Clock In Only (No Inspection)" with helper text: "Training, ride-along, shop, or other non-driver work". On click, calls `timesheetService.clockIn(...)` and navigates to `/timesheets`.
- Once started (or if manager): renders the full inspection form as usual.

### 2. `/return`
- On `/return`, check if the logged-in employee has an active shift.
- Render a prominent action card:
  - If `activeShift`:
    - Button: **"Clock Out Only (No Inspection)"** with subtitle *"Not driving or no vehicle to return"*.
    - On click: calls `timesheetService.clockOut(...)`, marks shift pending review, and shows success confirmation.
- Drivers with a vehicle selected can proceed through the return checklist, which clocks them out on submit.
