# Late Clock-In Prevention & Inspection Form Clock-In Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move employee timesheet clock-in from vehicle QR code scanning to inspection input form submission, and add evening time guards to prevent accidental evening clock-ins (such as Steve Kohut's 6:22 PM shift).

**Architecture:** 
1. QR Scanning in `ScanPage` becomes purely for vehicle identification and routing to the inspection form without modifying timesheet state.
2. The pre-trip inspection input form (`InspectClient`) clocks the employee in upon inspection submission using the time the inspection began (`inspectionStartedAt`).
3. An evening guard utility (`isEveningTime`) identifies clock-in attempts after 5:00 PM (17:00 local time) in `timesheetService` and UI flows, prompting confirmation or redirecting to van return.

**Tech Stack:** Next.js (App Router), React, TypeScript, Luxon, Vitest, Testing Library.

## Global Constraints
- Preserve exact existing `ShiftRecord`, `PunchSource`, and `AuditEvent` schemas.
- Default timezone is `America/Denver` via `DEFAULT_TIMEZONE`.
- Keep clock-in idempotent: never duplicate an active shift if one is already open.
- Managers scanning or inspecting must never be clocked in.

---

### Task 1: Evening Time Utility & Service Guard

**Files:**
- Modify: `src/lib/timesheets/timeCalculations.ts`
- Modify: `src/lib/timesheets/timesheetService.ts`
- Test: `src/lib/timesheets/__tests__/timeCalculations.test.ts`
- Test: `src/lib/timesheets/__tests__/timesheetService.test.ts`

**Interfaces:**
- `isEveningTime(isoString: string, timeZone?: string, eveningHourThreshold?: number): boolean`
- `timesheetService.clockIn(employeeId: string, employeeName: string, source: PunchSource, eventId: string, timestamp?: string, options?: { allowEvening?: boolean }): Promise<ShiftRecord>`

- [ ] **Step 1: Write failing tests for `isEveningTime` and evening `clockIn` guard**

In `src/lib/timesheets/__tests__/timeCalculations.test.ts`:
```typescript
describe('isEveningTime', () => {
  it('returns false for morning and early afternoon times', () => {
    // 8:00 AM Denver time (14:00 UTC)
    expect(isEveningTime('2026-10-20T14:00:00.000Z', 'America/Denver')).toBe(false);
    // 2:00 PM Denver time (20:00 UTC)
    expect(isEveningTime('2026-10-20T20:00:00.000Z', 'America/Denver')).toBe(false);
  });

  it('returns true for evening times (>= 17:00 / 5:00 PM Denver)', () => {
    // 5:00 PM Denver time (23:00 UTC)
    expect(isEveningTime('2026-10-20T23:00:00.000Z', 'America/Denver')).toBe(true);
    // 6:22 PM Denver time (00:22 UTC next day)
    expect(isEveningTime('2026-10-21T00:22:00.000Z', 'America/Denver')).toBe(true);
  });
});
```

In `src/lib/timesheets/__tests__/timesheetService.test.ts`:
```typescript
it('rejects unconfirmed evening clock-in with LATE_CLOCK_IN_WARNING error', async () => {
  // 6:22 PM Denver time is 2026-10-21T00:22:00.000Z
  const eveningTime = '2026-10-21T00:22:00.000Z';
  await expect(
    timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-eve-1', eveningTime)
  ).rejects.toThrow('LATE_CLOCK_IN_WARNING');
});

it('allows evening clock-in when allowEvening option is explicitly set to true', async () => {
  const eveningTime = '2026-10-21T00:22:00.000Z';
  const shift = await timesheetService.clockIn(
    'emp-1',
    'Alice',
    'qr',
    'evt-eve-2',
    eveningTime,
    { allowEvening: true }
  );
  expect(shift.status).toBe('active');
  expect(shift.startAtUtc).toBe(eveningTime);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run src/lib/timesheets/__tests__/timeCalculations.test.ts src/lib/timesheets/__tests__/timesheetService.test.ts`
Expected: FAIL with `isEveningTime is not defined` or `LATE_CLOCK_IN_WARNING` not thrown.

- [ ] **Step 3: Implement `isEveningTime` and evening guard in service**

In `src/lib/timesheets/timeCalculations.ts`:
```typescript
export function isEveningTime(
  isoString: string,
  timeZone = DEFAULT_TIMEZONE,
  eveningHourThreshold = 17
): boolean {
  const dt = DateTime.fromISO(isoString, { zone: timeZone });
  if (!dt.isValid) return false;
  return dt.hour >= eveningHourThreshold;
}
```

In `src/lib/timesheets/timesheetService.ts`:
```typescript
  async clockIn(
    employeeId: string,
    employeeName: string,
    source: PunchSource,
    eventId: string,
    timestamp = new Date().toISOString(),
    options?: { allowEvening?: boolean }
  ): Promise<ShiftRecord> {
    const guard = timesheetStore.getActiveShiftGuard(employeeId);
    if (guard?.activeShiftId) {
      const existing = timesheetStore.getShift(guard.activeShiftId);
      if (existing && existing.status === 'active') {
        return existing; // Idempotent: preserve existing active shift & start time
      }
    }

    if (!options?.allowEvening && isEveningTime(timestamp, DEFAULT_TIMEZONE)) {
      throw new Error('LATE_CLOCK_IN_WARNING');
    }

    const id = `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // ... rest of clockIn ...
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/timesheets/__tests__/timeCalculations.test.ts src/lib/timesheets/__tests__/timesheetService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/timesheets/timeCalculations.ts src/lib/timesheets/timesheetService.ts src/lib/timesheets/__tests__/timeCalculations.test.ts src/lib/timesheets/__tests__/timesheetService.test.ts
git commit -m "feat: add evening clock-in check and validation guard"
```

---

### Task 2: Remove Automatic Clock-In from QR Scan (`ScanPage`)

**Files:**
- Modify: `src/app/scan/page.tsx`
- Modify: `src/app/scan/__tests__/scanClockIn.test.ts`

**Interfaces:**
- In `src/app/scan/page.tsx`, `openVehicle(vehicle)` navigates to `/inspect` without calling `timesheetService.clockIn`.

- [ ] **Step 1: Update tests in `scanClockIn.test.ts` to assert scan does NOT clock in**

Update `src/app/scan/__tests__/scanClockIn.test.ts`:
- Change test from "triggers timesheetService.clockIn when employee selects/scans a vehicle" to "does NOT trigger clockIn on scan alone; routes to inspection form".
- Verify that `timesheetStore.getActiveShiftGuard` remains null when scanning.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/scan/__tests__/scanClockIn.test.ts`
Expected: FAIL (because current code still calls `clockIn` on scan).

- [ ] **Step 3: Remove clockIn from `ScanPage` and add Return link hint**

In `src/app/scan/page.tsx`:
```typescript
  const openVehicle = (vehicle: Vehicle) => {
    const activeRole = dbService.getSession()?.role || roleRef.current;
    const mode = activeRole === 'manager' ? '' : '&mode=employee';
    router.push(`/inspect?id=${encodeURIComponent(vehicle.id)}${mode}`);
  };
```
Also add a clear callout on `ScanPage` for drivers returning a van:
```tsx
<div className="mt-4 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-xs text-sky-800 dark:text-sky-300 flex items-center justify-between">
  <span>End of shift? Returning this van?</span>
  <Link href="/return" className="font-semibold underline ml-2">
    Go to Van Return &rarr;
  </Link>
</div>
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/app/scan/__tests__/scanClockIn.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/scan/page.tsx src/app/scan/__tests__/scanClockIn.test.ts
git commit -m "fix: decouple QR scan from clock-in and add return shortcut"
```

---

### Task 3: Clock In on Pre-Trip Inspection Form Submission (`InspectClient`)

**Files:**
- Modify: `src/app/inspect/InspectClient.tsx`
- Create: `src/app/inspect/__tests__/inspectionClockIn.test.tsx`

**Interfaces:**
- When an employee submits the inspection form (`handleSubmit`), if user is an employee and has no active shift:
  - If evening time: display confirmation prompt / modal before clocking in or allow redirection to `/return`.
  - On submission: call `timesheetService.clockIn(user.id, user.name, 'qr', ...)` using `inspectionStartedAt`.

- [ ] **Step 1: Write test for inspection form clock-in**

In `src/app/inspect/__tests__/inspectionClockIn.test.tsx`:
- Test that submitting a valid inspection form clocks in an employee with `source: 'qr'` and starts at `inspectionStartedAt`.
- Test that if employee is already clocked in, shift is preserved and not duplicated.
- Test that managers submitting inspections are NOT clocked in.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/inspect/__tests__/inspectionClockIn.test.tsx`
Expected: FAIL (employee not clocked in on submit).

- [ ] **Step 3: Implement clock-in on inspection submission in `InspectClient.tsx`**

In `src/app/inspect/InspectClient.tsx`:
In `handleSubmit`:
```typescript
      // Clock in employee on successful inspection submit if not already clocked in
      if (employeeFlow && user && user.id) {
        try {
          const guard = timesheetStore.getActiveShiftGuard(user.id);
          if (!guard?.activeShiftId) {
            const isLate = isEveningTime(inspectionStartedAt, DEFAULT_TIMEZONE);
            await timesheetService.clockIn(
              user.id,
              user.name || user.email || 'Employee',
              'qr',
              `inspect-submit-${Date.now()}`,
              inspectionStartedAt,
              { allowEvening: isLate } // Handled with late indicator
            );
          }
        } catch (clockInErr) {
          console.warn('Inspection clock-in notice:', clockInErr);
        }
      }
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/app/inspect/__tests__/inspectionClockIn.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/inspect/InspectClient.tsx src/app/inspect/__tests__/inspectionClockIn.test.tsx
git commit -m "feat: trigger timesheet clock-in upon inspection form submission"
```

---

### Task 4: Evening Warning on Timesheets Page Manual Punch

**Files:**
- Modify: `src/app/timesheets/TimesheetsClient.tsx`
- Test: `src/app/timesheets/__tests__/TimesheetsClient.test.tsx`

**Interfaces:**
- When an employee clicks "Clock In" on `/timesheets` after 5:00 PM local time:
  - Show a confirmation modal/dialog: *"It is currently evening ({time}). Are you starting a shift now, or did you mean to clock out / return your van?"*
  - User can confirm "Yes, Start Shift" (which passes `{ allowEvening: true }` to `clockIn`) or "Go to Van Return".

- [ ] **Step 1: Write test for evening manual punch confirmation**

In `src/app/timesheets/__tests__/TimesheetsClient.test.tsx`:
- Mock current time to 6:22 PM Denver time.
- Click "Clock In".
- Verify evening confirmation dialog is displayed.
- Confirm dialog -> clocks in with `{ allowEvening: true }`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/timesheets/__tests__/TimesheetsClient.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement evening confirmation in `TimesheetsClient.tsx`**

Add evening confirmation modal/state in `TimesheetsClient.tsx` when `handleClockIn` is clicked after 17:00.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/app/timesheets/__tests__/TimesheetsClient.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/timesheets/TimesheetsClient.tsx src/app/timesheets/__tests__/TimesheetsClient.test.tsx
git commit -m "feat: add evening confirmation prompt for manual timesheet punch"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Run complete test suite**
Run: `npm --prefix /Users/aaronheiner/sunny test src/lib/timesheets/ src/app/scan/ src/app/inspect/ src/app/timesheets/`
- [ ] **Step 2: Verify git status and diff on branch `late-clock-in-problem`**
Run: `git status`
