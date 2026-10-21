# October 20 Timesheets + Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden timesheet sync and historical missing-return recovery, polish Manager Analytics layout/sections, and ship automated tests plus a how-to-test guide on branch `october-20`.

**Architecture:** Keep the existing timesheet store/service and Maintenance Analytics modules. Add classified sync status messaging, a manager manual-end historical recovery path, CSS/layout cleanup for analytics, and Vitest coverage for every behavior change. Do not merge timesheets into fleet `dbService`.

**Tech Stack:** Next.js 14, React 18, TypeScript, Vitest, Testing Library, Luxon, Firebase Firestore (mocked in tests), CSS modules for analytics.

**Spec:** `docs/superpowers/specs/2026-10-20-timesheets-analytics-october-branch-design.md`

## Global Constraints

- Branch: `october-20` based on `origin/main` only.
- Clock-in only when the inspection form opens; scanner alone must not punch.
- Clock-out after successful return save; never fail return save on timesheet errors.
- No auto-guessed shift length for missing returns; manager must enter end time.
- Analytics remains maintenance/oil/equipment only (no payroll charts).
- Every changed behavior gets at least one automated test; existing suites must stay green.
- No live Firebase in CI; document Console rules checklist for humans.
- Prefer focused files; do not unilaterally rewrite large modules unless a task requires a small extracted helper.

## Scope note

This plan sequences **two subsystems** (timesheets, then analytics) for one branch merge. Tasks 1–5 are independently shippable as a timesheets PR if needed; Tasks 6–7 are analytics; Task 8 is docs + full verification.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/timesheets/timesheetStore.ts` | Classify listener/save sync failures; keep retry entrypoint |
| `src/app/timesheets/TimesheetsClient.tsx` | Sync banner severity styling (fail vs active) |
| `src/lib/timesheets/types.ts` | Allow `returnInspectionId: string \| null` + `manualEnd?: true` on recovery |
| `src/lib/timesheets/historicalRecovery.ts` | `makeManualEndRecoveredShift` + overlap helpers |
| `src/lib/timesheets/historicalRecoveryService.ts` | `recoverHistoricalEstimateWithManualEnd` |
| `src/app/timesheets/HistoricalHoursRecovery.tsx` | UI for attention rows with missing return: end-time input + save |
| `src/lib/timesheets/__tests__/*` | New/extended Vitest coverage |
| `src/components/__tests__/scannerClockIn.test.tsx` | Already asserts no scan punch — keep green |
| `src/app/inspect/inspectionTimesheetIndependence.test.tsx` | Already asserts form-entry clock-in — keep green |
| `src/components/analytics/analytics.module.css` | Layout/stacking/overflow polish |
| `src/components/analytics/fleetTimeline.module.css` | Timeline containment / marker stacking |
| `src/components/analytics/MaintenanceAnalytics.tsx` | Section copy/structure polish only where needed |
| `src/app/settings/page.tsx` | Manager Analytics entry card polish |
| `docs/october-20-testing-guide.md` | How to run tests + Firebase Console checklist |

---

### Task 1: Classify timesheet sync failure messages

**Files:**
- Modify: `src/lib/timesheets/timesheetStore.ts` (listener `fail` path ~391–437, save failure statuses ~508+)
- Modify: `src/app/timesheets/TimesheetsClient.tsx` (~508–528 sync banner)
- Test: `src/lib/timesheets/__tests__/timesheetCloudSync.test.ts`
- Test: `src/app/timesheets/__tests__/TimesheetsClient.test.tsx` (or add focused sync banner cases there)

**Interfaces:**
- Consumes: existing `setupFirestoreListeners()`, `getSyncStatus()`, `onSnapshot` error callback
- Produces: status strings that distinguish permission-denied vs generic connectivity when `error.code === 'permission-denied'` or message contains `permission`

- [ ] **Step 1: Write the failing test for permission-classified listener failure**

Add to `timesheetCloudSync.test.ts` (extend the existing `onError` test pattern ~267):

```ts
it('classifies permission-denied listener errors separately from generic failures', async () => {
  timesheetStore.reset();
  await timesheetStore.setupFirestoreListeners();
  const onError = mockOnSnapshot.mock.calls[0][3];
  onError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
  expect(timesheetStore.getSyncStatus()).toMatch(/permission/i);
  expect(timesheetStore.getSyncStatus()).toMatch(/Firebase|rules|Console/i);
});

it('keeps a generic cloud-sync failure message for non-permission errors', async () => {
  timesheetStore.reset();
  await timesheetStore.setupFirestoreListeners();
  const onError = mockOnSnapshot.mock.calls[0][3];
  onError(new Error('network-request-failed'));
  expect(timesheetStore.getSyncStatus()).toContain('Cloud sync failed');
  expect(timesheetStore.getSyncStatus()).not.toMatch(/Console rules/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/timesheets/__tests__/timesheetCloudSync.test.ts -t "classifies permission-denied"`

Expected: FAIL — current `fail()` always sets the generic permissions+connection string without distinguishing codes (or the new Console-rules wording is absent).

- [ ] **Step 3: Implement status classification in `timesheetStore`**

Update `fail` to accept the Firestore error and set:

- Permission: `Cloud sync failed: Firebase permission denied. Verify Console rules for timesheet collections, then retry.`
- Other: `Cloud sync failed. Check connection, then retry.`

Apply the same classification helper to punch/save failure status strings that currently always say “permissions”.

Keep `setupFirestoreListeners()` public for the existing Retry button.

- [ ] **Step 4: Style the sync banner by severity in `TimesheetsClient`**

When `syncStatus` matches `/failed|unavailable|permission/i`, use rose/amber border+background; when it matches `/Active|confirmed/i`, keep emerald; otherwise neutral/slate. Do not change Retry button behavior.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/lib/timesheets/__tests__/timesheetCloudSync.test.ts src/app/timesheets/__tests__/TimesheetsClient.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/timesheets/timesheetStore.ts src/app/timesheets/TimesheetsClient.tsx src/lib/timesheets/__tests__/timesheetCloudSync.test.ts src/app/timesheets/__tests__/TimesheetsClient.test.tsx
git commit -m "fix(timesheets): classify sync failures and banner severity"
```

---

### Task 2: Lock automatic punch contracts with regression tests

**Files:**
- Test (extend/confirm): `src/app/inspect/inspectionTimesheetIndependence.test.tsx`
- Test (extend/confirm): `src/components/__tests__/scannerClockIn.test.tsx`
- Test (extend/confirm): `src/lib/timesheets/__tests__/automaticPunchCloudContract.test.ts`
- Modify only if a contract is broken: `src/app/inspect/InspectClient.tsx`, `src/app/return/ReturnClient.tsx`, `src/components/QRScannerModal.tsx`

**Interfaces:**
- Consumes: `timesheetService.clockIn(employeeId, name, 'qr', eventId, timestamp?)`, `timesheetService.clockOut(..., 'checklist_return', ...)`
- Produces: documented regressions that fail if scan punches or form entry stops punching

- [ ] **Step 1: Add an explicit form-entry contract test if missing**

In `inspectionTimesheetIndependence.test.tsx` (or a sibling test file), ensure:

```ts
it('clocks in when the inspection form mounts for an employee', async () => {
  mock.clockIn.mockResolvedValue({ status: 'active' });
  render(<InspectClient />);
  await waitFor(() => expect(mock.clockIn).toHaveBeenCalledWith(
    'employee-1', 'Driver', 'qr', expect.any(String),
  ));
});
```

Confirm `scannerClockIn.test.tsx` still asserts `clockIn` is **not** called after a successful scan navigation.

- [ ] **Step 2: Add return clock-out contract if not already covered in UI tests**

Prefer extending an existing Return client test; if none exists, add `src/app/return/__tests__/returnClockOut.test.tsx` that mocks `timesheetService.clockOut` and asserts it is called after a successful return submit path (mirror patterns from `automaticPunchCloudContract.test.ts` for service-level and UI-level if practical).

Minimum service-level lock already in `automaticPunchCloudContract.test.ts` — keep it green. Add UI-level only if ReturnClient lacks coverage.

- [ ] **Step 3: Run punch contract tests**

Run: `npx vitest run src/app/inspect/inspectionTimesheetIndependence.test.tsx src/components/__tests__/scannerClockIn.test.tsx src/lib/timesheets/__tests__/automaticPunchCloudContract.test.ts`

Expected: PASS. If FAIL on production code, fix Inspect/Return/scanner to restore form-entry-only clock-in before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/app/inspect/inspectionTimesheetIndependence.test.tsx src/components/__tests__/scannerClockIn.test.tsx src/app/return/__tests__/returnClockOut.test.tsx src/app/inspect/InspectClient.tsx src/app/return/ReturnClient.tsx
git commit -m "test(timesheets): lock inspect clock-in and return clock-out contracts"
```

---

### Task 3: Domain support for missing-return manual end recovery

**Files:**
- Modify: `src/lib/timesheets/types.ts` (`recovery` on `ShiftRecord`)
- Modify: `src/lib/timesheets/historicalRecovery.ts`
- Modify: `src/lib/timesheets/historicalRecoveryService.ts`
- Test: `src/lib/timesheets/__tests__/punchPersistence.test.ts` (or new `historicalManualEnd.test.ts`)

**Interfaces:**
- Consumes: `HistoricalEstimate` with `state: 'attention'`, `inspectionId`, `startAtUtc`, `endAtUtc: null`
- Produces:

```ts
makeManualEndRecoveredShift(
  row: HistoricalEstimate,
  endAtUtc: string,
  actor: { id: string; name: string },
): ShiftRecord

recoverHistoricalEstimateWithManualEnd(
  inspectionId: string,
  endAtUtc: string,
  actor: { id: string; name: string },
): Promise<ShiftRecord>
```

Recovery metadata shape after this task:

```ts
recovery?: {
  estimated: true;
  inspectionId: string;
  returnInspectionId: string | null;
  manualEnd?: true;
  recoveredBy: string;
  recoveredByName: string;
  recoveredAt: string;
  startBasis: 'inspection started' | 'inspection submitted';
};
```

- [ ] **Step 1: Write failing domain tests**

```ts
import { buildHistoricalEstimates, makeManualEndRecoveredShift } from '../historicalRecovery';
import type { Inspection } from '@/types';

const pretripOnly = [{
  id: 'pre-1', userId: 'driver', userName: 'Driver', vehicleId: 'van',
  vehicleNumber: '5', submittedAt: '2026-10-12T14:00:00Z', kind: 'pretrip',
  status: 'passed', startedAt: '2026-10-12T13:50:00Z', startedAtRecorded: true,
}] as Inspection[];

it('flags pretrip-without-return as attention with missing return', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  expect(row.state).toBe('attention');
  expect(row.endAtUtc).toBeNull();
  expect(row.reason).toMatch(/return|Missing/i);
});

it('builds a pending recovered shift from manager end time', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  const shift = makeManualEndRecoveredShift(row, '2026-10-12T22:00:00.000Z', { id: 'm1', name: 'Manager' });
  expect(shift.status).toBe('pending');
  expect(shift.endAtUtc).toBe('2026-10-12T22:00:00.000Z');
  expect(shift.recovery?.manualEnd).toBe(true);
  expect(shift.recovery?.returnInspectionId).toBeNull();
  expect(shift.recovery?.inspectionId).toBe('pre-1');
});

it('rejects manual end at or before start', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  expect(() => makeManualEndRecoveredShift(row, '2026-10-12T13:00:00.000Z', { id: 'm1', name: 'Manager' }))
    .toThrow(/end time/i);
});

it('rejects manual end when period overlaps an existing shift', () => {
  const existing = makeManualEndRecoveredShift(
    buildHistoricalEstimates(pretripOnly, [])[0],
    '2026-10-12T22:00:00.000Z',
    { id: 'm1', name: 'Manager' },
  );
  const [row] = buildHistoricalEstimates(pretripOnly, [existing]);
  expect(() => makeManualEndRecoveredShift(row, '2026-10-12T21:00:00.000Z', { id: 'm1', name: 'Manager' }))
    .toThrow(/overlap/i);
});
```

Also update existing `makeRecoveredShift` callers if TypeScript requires `returnInspectionId: string | null` — ready-path recovery still sets a string return id.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/timesheets/__tests__/historicalManualEnd.test.ts`

Expected: FAIL (`makeManualEndRecoveredShift` missing)

- [ ] **Step 3: Implement domain helpers**

In `historicalRecovery.ts`:

- Improve attention reason when `start && !end` to: `No return submitted for this day. Enter an end time to add hours for review.`
- Implement `makeManualEndRecoveredShift`:
  - Require `row.inspectionId` and `row.startAtUtc`
  - Reject if `row.state === 'covered'`
  - Validate `Date.parse(endAtUtc) > Date.parse(row.startAtUtc)` and duration `<= 18h`
  - Reject if `overlapsHistoricalHours(...)`
  - Build pending `ShiftRecord` with `endSource: 'manual'`, `endEventId: historical-manual-${inspectionId}`, `managerNote` explaining manual end / no return, `recovery.manualEnd: true`, `recovery.returnInspectionId: null`
- Keep `makeRecoveredShift` for `ready` rows; widen type only.

In `historicalRecoveryService.ts`:

```ts
export async function recoverHistoricalEstimateWithManualEnd(
  inspectionId: string,
  endAtUtc: string,
  actor: { id: string; name: string },
) {
  const row = buildHistoricalEstimates(
    dbService.getInspections(),
    timesheetStore.getAllShifts(),
    timesheetStore.getAllCorrectionRequests(),
    dbService.getMissedReturns(),
  ).find(candidate => candidate.inspectionId === inspectionId);
  if (!row) throw new Error('Inspection evidence is no longer available. Refresh the preview.');
  return timesheetStore.saveRecoveredShift(makeManualEndRecoveredShift(row, endAtUtc, actor));
}
```

Ensure `saveRecoveredShift` still works when `returnInspectionId` is null (duplicate detection should key primarily on `inspectionId`).

- [ ] **Step 4: Run domain tests — expect PASS**

Run: `npx vitest run src/lib/timesheets/__tests__/historicalManualEnd.test.ts src/lib/timesheets/__tests__/punchPersistence.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/timesheets/types.ts src/lib/timesheets/historicalRecovery.ts src/lib/timesheets/historicalRecoveryService.ts src/lib/timesheets/__tests__/historicalManualEnd.test.ts
git commit -m "feat(timesheets): allow manager end time for missing-return recovery"
```

---

### Task 4: HistoricalHoursRecovery UI for manual end

**Files:**
- Modify: `src/app/timesheets/HistoricalHoursRecovery.tsx`
- Test: `src/app/timesheets/__tests__/HistoricalHoursRecovery.test.tsx` (create)

**Interfaces:**
- Consumes: `recoverHistoricalEstimate`, `recoverHistoricalEstimateWithManualEnd`
- Produces: For `attention` rows with `inspectionId` and `startAtUtc` and null `endAtUtc`, show datetime-local (or time) input + “Add with end time” button

- [ ] **Step 1: Write failing UI test**

```tsx
it('lets a manager set an end time on a missing-return row and save for review', async () => {
  // mock buildHistoricalEstimates / service as needed for a single attention row
  // open Recover historical hours
  // fill end time control labeled for that employee
  // click Add with end time
  // expect recoverHistoricalEstimateWithManualEnd to be called with inspection id + ISO end
});
```

Use the same Testing Library / createRoot patterns as other timesheet UI tests in this folder.

- [ ] **Step 2: Run UI test — expect FAIL**

Run: `npx vitest run src/app/timesheets/__tests__/HistoricalHoursRecovery.test.tsx`

Expected: FAIL (control missing)

- [ ] **Step 3: Implement UI**

For each row where `state === 'attention' && inspectionId && startAtUtc && !endAtUtc`:

- Show short reason (already in `row.reason`)
- `<input type="datetime-local" aria-label={\`End time for ${row.employeeName}\`} />` in America/Denver local interpretation via Luxon
- Button: `Add with end time` → `recoverHistoricalEstimateWithManualEnd(row.inspectionId, endIso, actor)`
- Keep existing `Add for review` for `state === 'ready'`
- On success, same pending message style as ready path

- [ ] **Step 4: Run UI + domain tests**

Run: `npx vitest run src/app/timesheets/__tests__/HistoricalHoursRecovery.test.tsx src/lib/timesheets/__tests__/historicalManualEnd.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/timesheets/HistoricalHoursRecovery.tsx src/app/timesheets/__tests__/HistoricalHoursRecovery.test.tsx
git commit -m "feat(timesheets): UI for missing-return historical end time"
```

---

### Task 5: Manager timesheet visibility under sync failure

**Files:**
- Modify: `src/app/timesheets/TimesheetsClient.tsx` (manager team table empty-state copy)
- Test: `src/app/timesheets/__tests__/TimesheetsClient.test.tsx` or `TimesheetsClientBranches.test.tsx`

**Interfaces:**
- Consumes: `timesheetStore.getAllShifts()`, `getSyncStatus()`
- Produces: If local/cached shifts exist while status matches `/failed|cached|waiting/i`, manager table still lists them; empty state must not imply “no hours worked” when sync failed with empty cache

- [ ] **Step 1: Write failing test**

Seed local shifts via store/test harness, set sync status to the failure string (spy `getSyncStatus`), render manager view, expect employee shift row visible and banner not emerald-success-only.

- [ ] **Step 2: Implement minimal empty-state / listing fix**

If shifts length > 0, always render rows regardless of sync status. If shifts length === 0 and status matches failure, show: `No timesheets loaded. Cloud sync failed — retry or check Firebase permissions.` instead of a success-sounding empty week message.

- [ ] **Step 3: Run tests + commit**

Run: `npx vitest run src/app/timesheets/__tests__/TimesheetsClient.test.tsx src/app/timesheets/__tests__/TimesheetsClientBranches.test.tsx`

```bash
git add src/app/timesheets/TimesheetsClient.tsx src/app/timesheets/__tests__/TimesheetsClient.test.tsx
git commit -m "fix(timesheets): keep manager visibility honest during sync failure"
```

---

### Task 6: Manager Analytics layout containment

**Files:**
- Modify: `src/components/analytics/analytics.module.css`
- Modify: `src/components/analytics/fleetTimeline.module.css`
- Test: existing `src/components/analytics/MaintenanceAnalytics.test.tsx` (must stay green)
- Optional verify: `scripts/check-manager-analytics.mjs`

**Interfaces:**
- Consumes: existing widget DOM (`data-analytics-widget`), timeline scroll containers
- Produces: no horizontal page overflow; sticky headers/markers below modal z-index (modals use `z-index: 100` in analytics CSS); timeline markers do not cover toolbar controls

- [ ] **Step 1: Reproduce with existing checks**

Run: `npx vitest run src/components/analytics/MaintenanceAnalytics.test.tsx`

If Playwright script is available locally:

Run: `node scripts/check-manager-analytics.mjs --help` (or existing flags from `docs/manager-analytics-acceptance.md`)

Note any overflow failures.

- [ ] **Step 2: Apply CSS containment fixes**

Minimum concrete changes:

1. `.page { overflow-x: clip; }` (or `hidden` if clip unsupported in target browsers you already use)
2. Ensure `.hero`, `.toolbar`, widget sections use `min-width: 0` in grid children
3. Timeline: keep `.scroll { overflow: auto; max-height: 75vh; }`; set marker `z-index` below sticky headers (`headers` already `z-index: 4`); add `isolation: isolate` on `.scroll`
4. Fixed/modals remain `z-index: 100+` above sticky `1–5`

- [ ] **Step 3: Re-run analytics tests**

Run: `npx vitest run src/components/analytics`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/analytics/analytics.module.css src/components/analytics/fleetTimeline.module.css
git commit -m "fix(analytics): contain overflow and stacking on manager analytics"
```

---

### Task 7: Analytics section polish + Settings entry

**Files:**
- Modify: `src/components/analytics/MaintenanceAnalytics.tsx` (hero/section headings and short hints only)
- Modify: `src/app/settings/page.tsx` (~621–624 Manager Analytics card)
- Modify: `src/components/analytics/analytics.module.css` (spacing rhythm for section titles)
- Test: `src/components/analytics/MaintenanceAnalytics.test.tsx` (update selectors only if copy changes break queries)

**Interfaces:**
- Consumes: existing widgets and Sample mode
- Produces: each major widget keeps one clear `<h2>`/`<h3>` + one supporting sentence; Settings card title/description clearer; no feature removal

- [ ] **Step 1: Polish Settings entry card**

```tsx
<Link href="/settings/analytics" className="card card-pad spread hover:border-ink-muted transition-colors">
  <div>
    <strong>Manager Analytics</strong>
    <p className="hint mt-1">
      Plan oil and equipment service, review due work, and export maintenance data.
    </p>
  </div>
  <Gauge className="w-6 h-6 shrink-0" aria-hidden />
</Link>
```

- [ ] **Step 2: Section polish inside `MaintenanceAnalytics`**

For each widget block (metrics, outlook, vehicles, equipment, timeline): ensure a single heading + one short hint; remove redundant eyebrow stacks that crowd the first viewport of a section; keep pinned weekly actions behavior unchanged.

- [ ] **Step 3: Run analytics tests and fix any text-selector breakage**

Run: `npx vitest run src/components/analytics`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/analytics/MaintenanceAnalytics.tsx src/components/analytics/analytics.module.css src/app/settings/page.tsx src/components/analytics/MaintenanceAnalytics.test.tsx
git commit -m "polish(analytics): clarify sections and settings entry"
```

---

### Task 8: Testing guide + full verification

**Files:**
- Create: `docs/october-20-testing-guide.md`

**Interfaces:**
- Consumes: npm scripts `test`, `test:watch`, `test:coverage`; analytics script; Firestore collection names from `timesheetStore`
- Produces: owner-facing guide matching the approved spec §3

- [ ] **Step 1: Write `docs/october-20-testing-guide.md`**

Must include:

1. **Smoke:** `npm test` — how to read “X passed” vs failure stack  
2. **Watch:** `npm run test:watch`  
3. **Coverage (optional):** `npm run test:coverage`  
4. **Types/build:** `npx tsc --noEmit`, `npm run build`  
5. **Analytics layout script:** command from acceptance doc / `scripts/check-manager-analytics.mjs`  
6. **Firebase Console checklist** for authenticated app users (adjust exact rule language to match your project’s auth model):

   | Collection | Read | Write |
   |------------|------|-------|
   | `timesheet_shifts` | yes | yes |
   | `timesheet_guards` | yes | yes |
   | `timesheet_audit` | yes | yes |
   | `timesheet_corrections` | yes | yes |

   Steps: Firebase Console → Firestore → Rules → confirm these paths are allowed for signed-in app users; retry Timesheets “Retry cloud sync”.

7. **Manual spot-check (only):**
   - Employee opens inspection form → active shift appears / clock-in retry if failed  
   - Complete return → shift pending / clock-out retry if failed  
   - Manager Timesheets sees the shift  
   - Historical week: missing return → enter end time → pending recovery  
   - Settings → Manager Analytics on a phone-width window: no horizontal scroll / overlap  

8. **How to know it’s wrong:** red Vitest; rose sync banner; historical attention without override control; analytics horizontal scrollbar on `.page`

- [ ] **Step 2: Run full verification**

```bash
npm test
npx tsc --noEmit --incremental false
```

Expected: all Vitest files pass; tsc exit 0.

Optional: `npm run build` if time allows.

- [ ] **Step 3: Commit guide**

```bash
git add docs/october-20-testing-guide.md
git commit -m "docs: add October 20 testing guide and Firebase checklist"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Sync UX + permission clarity + retry | Task 1 |
| Clock-in on inspect form; not on scan; tests | Task 2 |
| Clock-out on return; tests | Task 2 |
| Historical missing-return manager end time | Tasks 3–4 |
| Manager visibility during sync issues | Task 5 |
| Analytics layout then polish | Tasks 6–7 |
| Testing guide + Console checklist | Task 8 |
| No dbService merge / no scan punch / no auto shift length | Global constraints + Tasks 2–3 |
| Existing suites stay green | Each task run step + Task 8 |

No TBD placeholders remain. Types use `returnInspectionId: string | null` and `manualEnd?: true` consistently across Tasks 3–4.
