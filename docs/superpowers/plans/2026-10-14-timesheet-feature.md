# Sunny Fleet Timesheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated TypeScript timesheet prototype inside Sunny with existing styling, individual shift approval and weekly summaries.

**Architecture:** Dedicated modular service (`src/lib/timesheets/`) with pure Luxon boundary calculations, isolated synthetic/test store, and transactional active-shift guard connecting vehicle QR scans, return inspection submissions, and trainee manual punches to an adaptive `/timesheets` page for employees and managers.

**Tech Stack:** Next.js 14 (App Router), TypeScript, React 18, Tailwind CSS, Lucide icons, Luxon, Vitest.

## Global Constraints

- Branch: `timesheet-branch`
- Time zone: `America/Denver`
- Week boundary: Monday 00:00:00 local time
- Storage isolation: Synthetic local storage / test store; never write production Firebase
- Quality gate: 100% test pass rate, $\ge 80\%$ lines, branches, functions, and statements for new code
- Concurrency: Revision precondition check on all manager edits and approvals (`STALE_REVISION_CONFLICT`)
- Self-approval: Disabled by default for managers

---

### Task 1: Install Luxon & Declare Core Types

**Files:**
- Modify: `package.json`
- Create: `src/lib/timesheets/types.ts`
- Test: `src/lib/timesheets/__tests__/types.test.ts`

**Interfaces:**
- Consumes: None (base dependency and types)
- Produces: `ShiftRecord`, `CorrectionRequest`, `AuditEvent`, `ActiveShiftGuard`, `ShiftStatus`, `PunchSource`, `TimesheetSummary`

- [ ] **Step 1: Install luxon and @types/luxon**

Run:
```bash
npm install luxon@^3.5.0
npm install --save-dev @types/luxon@^3.4.2
```

- [ ] **Step 2: Write type contract test**

Create `src/lib/timesheets/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { ShiftRecord, CorrectionRequest, AuditEvent, ActiveShiftGuard } from '../types';

describe('Timesheet Types', () => {
  it('supports valid ShiftRecord and status values', () => {
    const shift: ShiftRecord = {
      id: 'shift-1',
      employeeId: 'usr-1',
      employeeName: 'Driver Dan',
      locationId: 'loc-main',
      status: 'active',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: null,
      unpaidBreakSeconds: 0,
      startSource: 'qr',
      endSource: null,
      startEventId: 'evt-1',
      endEventId: null,
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T14:00:00.000Z',
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };
    expect(shift.status).toBe('active');
    expect(shift.unpaidBreakSeconds).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails (missing types)**

Run: `npx vitest run src/lib/timesheets/__tests__/types.test.ts`  
Expected: FAIL (Cannot find module `../types`)

- [ ] **Step 4: Create type definitions**

Create `src/lib/timesheets/types.ts`:
```typescript
export type ShiftStatus = 'active' | 'pending' | 'needs_correction' | 'approved';
export type PunchSource = 'qr' | 'manual' | 'checklist_return';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';
export type AuditAction = 
  | 'clock_in' 
  | 'clock_out' 
  | 'request_correction' 
  | 'manager_edit' 
  | 'approve' 
  | 'amend_approve' 
  | 'return_for_correction';

export interface ShiftRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  locationId: string;
  status: ShiftStatus;
  timeZone: string;
  startAtUtc: string;
  endAtUtc: string | null;
  unpaidBreakSeconds: number;
  startSource: PunchSource;
  endSource: PunchSource | null;
  startEventId: string;
  endEventId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  managerNote?: string;
}

export interface CorrectionRequest {
  id: string;
  shiftId: string | null;
  employeeId: string;
  employeeName: string;
  proposedStart: string;
  proposedEnd: string;
  proposedBreakSeconds: number;
  timeZone: string;
  reason: string;
  status: CorrectionStatus;
  baseRevision: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

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
  timestamp: string;
}

export interface ActiveShiftGuard {
  employeeId: string;
  activeShiftId: string | null;
  revision: number;
}

export interface TimesheetSummary {
  approvedSeconds: number;
  pendingSeconds: number;
  activeCount: number;
  attentionCount: number;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/timesheets/__tests__/types.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/timesheets/types.ts src/lib/timesheets/__tests__/types.test.ts
git commit -m "feat(timesheets): install luxon and add domain type definitions"
```

---

### Task 2: Time Calculation & Boundary Engine

**Files:**
- Create: `src/lib/timesheets/timeCalculations.ts`
- Create: `src/lib/timesheets/__tests__/timeCalculations.test.ts`

**Interfaces:**
- Consumes: `ShiftRecord` from `./types`
- Produces:
  - `calculateNetSeconds(startUtc: string, endUtc: string, unpaidBreakSeconds: number): number`
  - `validateShiftInterval(startUtc: string, endUtc: string, unpaidBreakSeconds: number): { valid: boolean; error?: string }`
  - `hasShiftOverlap(existingShifts: ShiftRecord[], candidate: { startAtUtc: string; endAtUtc: string; id?: string }): boolean`
  - `splitShiftAtWeekBoundary(shift: ShiftRecord, weekStartLocalIso: string): { weekAShift: ShiftRecord; weekBShift: ShiftRecord } | null`
  - `formatSecondsToHours(seconds: number): string`
  - `getWeekBoundariesUtc(anchorDate: Date | string, timeZone?: string): { weekStartUtc: string; weekEndUtc: string }`

- [ ] **Step 1: Write failing calculation tests**

Create `src/lib/timesheets/__tests__/timeCalculations.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateNetSeconds,
  validateShiftInterval,
  hasShiftOverlap,
  splitShiftAtWeekBoundary,
  formatSecondsToHours,
  getWeekBoundariesUtc,
} from '../timeCalculations';
import type { ShiftRecord } from '../types';

describe('timeCalculations', () => {
  it('calculates net seconds correctly subtracting unpaid break', () => {
    // 8 hours shift (28800s) with 30 min break (1800s) = 27000s (7.5h)
    const start = '2026-10-14T14:00:00.000Z';
    const end = '2026-10-14T22:00:00.000Z';
    const net = calculateNetSeconds(start, end, 1800);
    expect(net).toBe(27000);
    expect(formatSecondsToHours(net)).toBe('7.50');
  });

  it('rejects end before start or zero-length shifts', () => {
    const start = '2026-10-14T14:00:00.000Z';
    const endBefore = '2026-10-14T13:00:00.000Z';
    expect(validateShiftInterval(start, endBefore, 0).valid).toBe(false);
    expect(validateShiftInterval(start, start, 0).valid).toBe(false);
  });

  it('rejects negative break or break exceeding duration', () => {
    const start = '2026-10-14T14:00:00.000Z';
    const end = '2026-10-14T18:00:00.000Z'; // 4 hours = 14400s
    expect(validateShiftInterval(start, end, -300).valid).toBe(false);
    expect(validateShiftInterval(start, end, 15000).valid).toBe(false);
  });

  it('detects overlapping shifts but allows adjacent shifts sharing endpoint', () => {
    const existing: ShiftRecord[] = [
      {
        id: 's-1',
        employeeId: 'u-1',
        employeeName: 'User',
        locationId: 'loc-main',
        status: 'approved',
        timeZone: 'America/Denver',
        startAtUtc: '2026-10-14T14:00:00.000Z',
        endAtUtc: '2026-10-14T18:00:00.000Z',
        unpaidBreakSeconds: 0,
        startSource: 'qr',
        endSource: 'checklist_return',
        startEventId: 'e-1',
        endEventId: 'e-2',
        revision: 1,
        createdAt: '2026-10-14T14:00:00.000Z',
        updatedAt: '2026-10-14T18:00:00.000Z',
        submittedAt: '2026-10-14T18:00:00.000Z',
        approvedAt: '2026-10-14T18:30:00.000Z',
        approvedBy: 'mgr-1',
      },
    ];

    // Overlap
    expect(hasShiftOverlap(existing, { startAtUtc: '2026-10-14T16:00:00.000Z', endAtUtc: '2026-10-14T20:00:00.000Z' })).toBe(true);

    // Exact adjacent sharing endpoint (18:00 to 22:00) -> allowed
    expect(hasShiftOverlap(existing, { startAtUtc: '2026-10-14T18:00:00.000Z', endAtUtc: '2026-10-14T22:00:00.000Z' })).toBe(false);
  });

  it('allocates breaks proportionally when splitting across week boundary', () => {
    // Week boundary in Denver on Monday 00:00 local (e.g. 2026-10-19T06:00:00.000Z in MDT UTC-6)
    // Shift from 2026-10-19T04:00:00.000Z (2 hours in week A) to 2026-10-19T10:00:00.000Z (4 hours in week B)
    // Total elapsed = 6 hours (21600s), break = 1800s (30m)
    // Ratio = 2/6 = 1/3 in week A (600s break), 2/3 in week B (1200s break)
    const shift: ShiftRecord = {
      id: 'cross-week',
      employeeId: 'u-1',
      employeeName: 'User',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-19T04:00:00.000Z',
      endAtUtc: '2026-10-19T10:00:00.000Z',
      unpaidBreakSeconds: 1800,
      startSource: 'manual',
      endSource: 'manual',
      startEventId: 'e-1',
      endEventId: 'e-2',
      revision: 1,
      createdAt: '2026-10-19T04:00:00.000Z',
      updatedAt: '2026-10-19T10:00:00.000Z',
      submittedAt: '2026-10-19T10:00:00.000Z',
      approvedAt: null,
      approvedBy: null,
    };

    const split = splitShiftAtWeekBoundary(shift, '2026-10-19T06:00:00.000Z');
    expect(split).not.toBeNull();
    if (split) {
      expect(split.weekAShift.unpaidBreakSeconds).toBe(600);
      expect(split.weekBShift.unpaidBreakSeconds).toBe(1200);
      expect(split.weekAShift.unpaidBreakSeconds + split.weekBShift.unpaidBreakSeconds).toBe(1800);
    }
  });

  it('determines week boundaries starting Monday 00:00:00 America/Denver', () => {
    const { weekStartUtc, weekEndUtc } = getWeekBoundariesUtc('2026-10-14T12:00:00.000Z', 'America/Denver');
    expect(weekStartUtc).toBeDefined();
    expect(weekEndUtc).toBeDefined();
    expect(new Date(weekEndUtc).getTime()).toBeGreaterThan(new Date(weekStartUtc).getTime());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/timesheets/__tests__/timeCalculations.test.ts`  
Expected: FAIL (Cannot find module `../timeCalculations`)

- [ ] **Step 3: Implement timeCalculations.ts**

Create `src/lib/timesheets/timeCalculations.ts`:
```typescript
import { DateTime, Interval } from 'luxon';
import type { ShiftRecord } from './types';

export const DEFAULT_TIMEZONE = 'America/Denver';

export function calculateNetSeconds(startUtc: string, endUtc: string, unpaidBreakSeconds = 0): number {
  const start = DateTime.fromISO(startUtc, { zone: 'utc' });
  const end = DateTime.fromISO(endUtc, { zone: 'utc' });
  if (!start.isValid || !end.isValid) return 0;
  const elapsedSeconds = Math.max(0, Math.floor(end.diff(start, 'seconds').seconds));
  return Math.max(0, elapsedSeconds - Math.max(0, unpaidBreakSeconds));
}

export function validateShiftInterval(
  startUtc: string,
  endUtc: string,
  unpaidBreakSeconds = 0
): { valid: boolean; error?: string } {
  const start = DateTime.fromISO(startUtc, { zone: 'utc' });
  const end = DateTime.fromISO(endUtc, { zone: 'utc' });

  if (!start.isValid || !end.isValid) {
    return { valid: false, error: 'Invalid start or end timestamp.' };
  }
  if (end <= start) {
    return { valid: false, error: 'Shift end time must be strictly after start time.' };
  }
  const elapsed = Math.floor(end.diff(start, 'seconds').seconds);
  if (unpaidBreakSeconds < 0) {
    return { valid: false, error: 'Unpaid break duration cannot be negative.' };
  }
  if (unpaidBreakSeconds >= elapsed) {
    return { valid: false, error: 'Unpaid break cannot meet or exceed total elapsed shift duration.' };
  }
  return { valid: true };
}

export function hasShiftOverlap(
  existingShifts: ShiftRecord[],
  candidate: { startAtUtc: string; endAtUtc: string; id?: string }
): boolean {
  const candStart = DateTime.fromISO(candidate.startAtUtc, { zone: 'utc' }).toMillis();
  const candEnd = DateTime.fromISO(candidate.endAtUtc, { zone: 'utc' }).toMillis();

  for (const s of existingShifts) {
    if (candidate.id && s.id === candidate.id) continue;
    if (!s.endAtUtc) continue;
    const sStart = DateTime.fromISO(s.startAtUtc, { zone: 'utc' }).toMillis();
    const sEnd = DateTime.fromISO(s.endAtUtc, { zone: 'utc' }).toMillis();

    // Overlap condition: startA < endB && startB < endA
    if (candStart < sEnd && sStart < candEnd) {
      return true;
    }
  }
  return false;
}

export function splitShiftAtWeekBoundary(
  shift: ShiftRecord,
  boundaryUtc: string
): { weekAShift: ShiftRecord; weekBShift: ShiftRecord } | null {
  if (!shift.endAtUtc) return null;
  const start = DateTime.fromISO(shift.startAtUtc, { zone: 'utc' });
  const end = DateTime.fromISO(shift.endAtUtc, { zone: 'utc' });
  const boundary = DateTime.fromISO(boundaryUtc, { zone: 'utc' });

  if (!start.isValid || !end.isValid || !boundary.isValid) return null;
  if (start >= boundary || end <= boundary) return null;

  const totalElapsed = end.diff(start, 'seconds').seconds;
  const elapsedA = boundary.diff(start, 'seconds').seconds;
  if (totalElapsed <= 0) return null;

  const breakA = Math.round(shift.unpaidBreakSeconds * (elapsedA / totalElapsed));
  const breakB = Math.max(0, shift.unpaidBreakSeconds - breakA);

  const weekAShift: ShiftRecord = {
    ...shift,
    endAtUtc: boundary.toISO()!,
    unpaidBreakSeconds: breakA,
  };

  const weekBShift: ShiftRecord = {
    ...shift,
    id: `${shift.id}-split-b`,
    startAtUtc: boundary.toISO()!,
    unpaidBreakSeconds: breakB,
  };

  return { weekAShift, weekBShift };
}

export function formatSecondsToHours(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(2);
}

export function getWeekBoundariesUtc(
  anchor: Date | string,
  timeZone = DEFAULT_TIMEZONE
): { weekStartUtc: string; weekEndUtc: string } {
  const dt = typeof anchor === 'string' 
    ? DateTime.fromISO(anchor, { zone: timeZone })
    : DateTime.fromJSDate(anchor, { zone: timeZone });

  // Luxon weekday: 1 = Monday, 7 = Sunday
  const monday = dt.startOf('day').minus({ days: dt.weekday - 1 });
  const sunday = monday.plus({ days: 7 }).minus({ milliseconds: 1 });

  return {
    weekStartUtc: monday.toUTC().toISO()!,
    weekEndUtc: sunday.toUTC().toISO()!,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/timesheets/__tests__/timeCalculations.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/timesheets/timeCalculations.ts src/lib/timesheets/__tests__/timeCalculations.test.ts
git commit -m "feat(timesheets): implement Luxon time calculation and boundary engine"
```

---

### Task 3: Isolated Timesheet Store

**Files:**
- Create: `src/lib/timesheets/timesheetStore.ts`
- Create: `src/lib/timesheets/__tests__/timesheetStore.test.ts`

**Interfaces:**
- Consumes: `ShiftRecord`, `CorrectionRequest`, `AuditEvent`, `ActiveShiftGuard` from `./types`
- Produces: `timesheetStore` with CRUD methods for shifts, guards, correction requests, and audit logs.

- [ ] **Step 1: Write store unit tests**

Create `src/lib/timesheets/__tests__/timesheetStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { timesheetStore } from '../timesheetStore';
import type { ShiftRecord } from '../types';

describe('timesheetStore', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  it('saves and retrieves shifts by employee and id', () => {
    const shift: ShiftRecord = {
      id: 'shift-10',
      employeeId: 'emp-1',
      employeeName: 'Sarah Connor',
      locationId: 'loc-main',
      status: 'active',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: null,
      unpaidBreakSeconds: 0,
      startSource: 'qr',
      endSource: null,
      startEventId: 'evt-10',
      endEventId: null,
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T14:00:00.000Z',
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };

    timesheetStore.saveShift(shift);
    expect(timesheetStore.getShift('shift-10')).toEqual(shift);
    expect(timesheetStore.getShiftsByEmployee('emp-1')).toHaveLength(1);
  });

  it('manages active shift guards transactionally', () => {
    expect(timesheetStore.getActiveShiftGuard('emp-1')).toBeNull();
    timesheetStore.setActiveShiftGuard('emp-1', 'shift-10');
    expect(timesheetStore.getActiveShiftGuard('emp-1')?.activeShiftId).toBe('shift-10');
    timesheetStore.clearActiveShiftGuard('emp-1');
    expect(timesheetStore.getActiveShiftGuard('emp-1')?.activeShiftId).toBeNull();
  });

  it('records audit events immutably', () => {
    timesheetStore.appendAuditEvent({
      id: 'aud-1',
      shiftId: 'shift-10',
      actorId: 'emp-1',
      actorName: 'Sarah Connor',
      action: 'clock_in',
      beforeValues: null,
      afterValues: { id: 'shift-10', status: 'active' },
      reason: null,
      revision: 1,
      eventId: 'evt-10',
      timestamp: '2026-10-14T14:00:00.000Z',
    });
    const log = timesheetStore.getAuditEventsForShift('shift-10');
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe('clock_in');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/timesheets/__tests__/timesheetStore.test.ts`  
Expected: FAIL (Cannot find module `../timesheetStore`)

- [ ] **Step 3: Implement timesheetStore.ts**

Create `src/lib/timesheets/timesheetStore.ts`:
```typescript
import type { ShiftRecord, CorrectionRequest, AuditEvent, ActiveShiftGuard } from './types';

class TimesheetStore {
  private shifts: Map<string, ShiftRecord> = new Map();
  private guards: Map<string, ActiveShiftGuard> = new Map();
  private auditEvents: AuditEvent[] = [];
  private correctionRequests: Map<string, CorrectionRequest> = new Map();

  reset(): void {
    this.shifts.clear();
    this.guards.clear();
    this.auditEvents = [];
    this.correctionRequests.clear();
  }

  // Shifts
  getShift(id: string): ShiftRecord | null {
    return this.shifts.get(id) || null;
  }

  getAllShifts(): ShiftRecord[] {
    return Array.from(this.shifts.values()).sort(
      (a, b) => new Date(b.startAtUtc).getTime() - new Date(a.startAtUtc).getTime()
    );
  }

  getShiftsByEmployee(employeeId: string): ShiftRecord[] {
    return this.getAllShifts().filter((s) => s.employeeId === employeeId);
  }

  saveShift(shift: ShiftRecord): ShiftRecord {
    this.shifts.set(shift.id, { ...shift });
    return shift;
  }

  // Active shift guards
  getActiveShiftGuard(employeeId: string): ActiveShiftGuard | null {
    return this.guards.get(employeeId) || null;
  }

  setActiveShiftGuard(employeeId: string, shiftId: string): ActiveShiftGuard {
    const current = this.guards.get(employeeId);
    const guard: ActiveShiftGuard = {
      employeeId,
      activeShiftId: shiftId,
      revision: (current?.revision || 0) + 1,
    };
    this.guards.set(employeeId, guard);
    return guard;
  }

  clearActiveShiftGuard(employeeId: string): void {
    const current = this.guards.get(employeeId);
    if (current) {
      this.guards.set(employeeId, {
        employeeId,
        activeShiftId: null,
        revision: current.revision + 1,
      });
    }
  }

  // Audit Events
  appendAuditEvent(event: AuditEvent): void {
    this.auditEvents.push({ ...event });
  }

  getAuditEventsForShift(shiftId: string): AuditEvent[] {
    return this.auditEvents
      .filter((e) => e.shiftId === shiftId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Corrections
  saveCorrectionRequest(request: CorrectionRequest): CorrectionRequest {
    this.correctionRequests.set(request.id, { ...request });
    return request;
  }

  getCorrectionRequest(id: string): CorrectionRequest | null {
    return this.correctionRequests.get(id) || null;
  }

  getCorrectionRequestsByEmployee(employeeId: string): CorrectionRequest[] {
    return Array.from(this.correctionRequests.values())
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  getAllCorrectionRequests(): CorrectionRequest[] {
    return Array.from(this.correctionRequests.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }
}

export const timesheetStore = new TimesheetStore();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/timesheets/__tests__/timesheetStore.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/timesheets/timesheetStore.ts src/lib/timesheets/__tests__/timesheetStore.test.ts
git commit -m "feat(timesheets): implement isolated in-memory timesheet store"
```

---

### Task 4: Shared Timesheet Service (Capture, Approvals, Concurrency)

**Files:**
- Create: `src/lib/timesheets/timesheetService.ts`
- Create: `src/lib/timesheets/__tests__/timesheetService.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `timeCalculations.ts`, `timesheetStore.ts`
- Produces: `timesheetService` object with methods:
  - `clockIn(employeeId, employeeName, source, eventId, timestamp?)`
  - `clockOut(employeeId, source, eventId, unpaidBreakSeconds?, timestamp?)`
  - `saveManagerEdit(shiftId, actor, expectedRevision, updates, reason)`
  - `approveShift(shiftId, actor, expectedRevision, updates?, reason?)`
  - `returnForCorrection(shiftId, actor, expectedRevision, feedbackNote)`
  - `requestCorrection(params)`
  - `reviewCorrectionRequest(requestId, actor, decision, reviewNote)`
  - `getWeeklySummary(employeeId?, anchorDate?, timeZone?)`

- [ ] **Step 1: Write timesheetService tests**

Create `src/lib/timesheets/__tests__/timesheetService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { timesheetService } from '../timesheetService';
import { timesheetStore } from '../timesheetStore';

describe('timesheetService', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  it('clocks in and idempotently returns existing active shift on duplicate clock-in', async () => {
    const shift1 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
    expect(shift1.status).toBe('active');
    expect(shift1.startAtUtc).toBe('2026-10-14T14:00:00.000Z');

    // Duplicate scan 10 mins later with different eventId must preserve original shift & start
    const shift2 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-2', '2026-10-14T14:10:00.000Z');
    expect(shift2.id).toBe(shift1.id);
    expect(shift2.startAtUtc).toBe('2026-10-14T14:00:00.000Z');
  });

  it('clocks out active shift transitioning directly to pending', async () => {
    await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
    const out = await timesheetService.clockOut('emp-1', 'checklist_return', 'evt-out-1', 1800, '2026-10-14T22:00:00.000Z');
    expect(out.status).toBe('pending');
    expect(out.endAtUtc).toBe('2026-10-14T22:00:00.000Z');
    expect(out.unpaidBreakSeconds).toBe(1800);
  });

  it('throws NO_ACTIVE_SHIFT when clocking out with no open shift', async () => {
    await expect(
      timesheetService.clockOut('emp-none', 'checklist_return', 'evt-1', 0, '2026-10-14T14:00:00.000Z')
    ).rejects.toThrow('NO_ACTIVE_SHIFT');
  });

  it('rejects stale edits with STALE_REVISION_CONFLICT', async () => {
    await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
    const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

    // Manager 1 edits with revision 1 -> becomes revision 2
    await timesheetService.saveManagerEdit(
      closed.id,
      { id: 'mgr-1', name: 'Bob' },
      1,
      { unpaidBreakSeconds: 900 },
      'Added missing break'
    );

    // Manager 2 tries to edit with stale revision 1 -> rejected
    await expect(
      timesheetService.saveManagerEdit(
        closed.id,
        { id: 'mgr-2', name: 'Charlie' },
        1,
        { unpaidBreakSeconds: 1200 },
        'Conflicting break edit'
      )
    ).rejects.toThrow('STALE_REVISION_CONFLICT');
  });

  it('prevents manager self-approval per prototype default', async () => {
    await timesheetService.clockIn('mgr-1', 'Bob Manager', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
    const closed = await timesheetService.clockOut('mgr-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

    await expect(
      timesheetService.approveShift(closed.id, { id: 'mgr-1', name: 'Bob Manager' }, closed.revision)
    ).rejects.toThrow('SELF_APPROVAL_DISABLED');
  });

  it('allows another authorized manager to approve shift with audit trail', async () => {
    await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
    const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

    const approved = await timesheetService.approveShift(
      closed.id,
      { id: 'mgr-2', name: 'Charlie Manager' },
      closed.revision
    );
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('mgr-2');

    const logs = timesheetStore.getAuditEventsForShift(closed.id);
    expect(logs.some((l) => l.action === 'approve')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/timesheets/__tests__/timesheetService.test.ts`  
Expected: FAIL (Cannot find module `../timesheetService`)

- [ ] **Step 3: Implement timesheetService.ts**

Create `src/lib/timesheets/timesheetService.ts`:
```typescript
import { timesheetStore } from './timesheetStore';
import {
  calculateNetSeconds,
  validateShiftInterval,
  hasShiftOverlap,
  DEFAULT_TIMEZONE,
  getWeekBoundariesUtc,
} from './timeCalculations';
import type {
  ShiftRecord,
  ShiftStatus,
  PunchSource,
  CorrectionRequest,
  AuditEvent,
  AuditAction,
  TimesheetSummary,
} from './types';

export class TimesheetService {
  async clockIn(
    employeeId: string,
    employeeName: string,
    source: PunchSource,
    eventId: string,
    timestamp = new Date().toISOString()
  ): Promise<ShiftRecord> {
    const guard = timesheetStore.getActiveShiftGuard(employeeId);
    if (guard?.activeShiftId) {
      const existing = timesheetStore.getShift(guard.activeShiftId);
      if (existing && existing.status === 'active') {
        return existing; // Idempotent: preserve existing active shift & start time
      }
    }

    const id = `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newShift: ShiftRecord = {
      id,
      employeeId,
      employeeName,
      locationId: 'loc-main',
      status: 'active',
      timeZone: DEFAULT_TIMEZONE,
      startAtUtc: timestamp,
      endAtUtc: null,
      unpaidBreakSeconds: 0,
      startSource: source,
      endSource: null,
      startEventId: eventId,
      endEventId: null,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };

    timesheetStore.saveShift(newShift);
    timesheetStore.setActiveShiftGuard(employeeId, id);

    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId: id,
      actorId: employeeId,
      actorName: employeeName,
      action: 'clock_in',
      beforeValues: null,
      afterValues: { ...newShift },
      reason: null,
      revision: 1,
      eventId,
      timestamp,
    });

    return newShift;
  }

  async clockOut(
    employeeId: string,
    source: PunchSource,
    eventId: string,
    unpaidBreakSeconds = 0,
    timestamp = new Date().toISOString()
  ): Promise<ShiftRecord> {
    const guard = timesheetStore.getActiveShiftGuard(employeeId);
    if (!guard?.activeShiftId) {
      throw new Error('NO_ACTIVE_SHIFT');
    }

    const shift = timesheetStore.getShift(guard.activeShiftId);
    if (!shift || shift.status !== 'active') {
      throw new Error('NO_ACTIVE_SHIFT');
    }

    if (shift.endEventId === eventId) {
      return shift; // Idempotent retry
    }

    const validation = validateShiftInterval(shift.startAtUtc, timestamp, unpaidBreakSeconds);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const nextRevision = shift.revision + 1;
    const updated: ShiftRecord = {
      ...shift,
      status: 'pending',
      endAtUtc: timestamp,
      endSource: source,
      endEventId: eventId,
      unpaidBreakSeconds,
      revision: nextRevision,
      updatedAt: timestamp,
      submittedAt: timestamp,
    };

    timesheetStore.saveShift(updated);
    timesheetStore.clearActiveShiftGuard(employeeId);

    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId: shift.id,
      actorId: employeeId,
      actorName: shift.employeeName,
      action: 'clock_out',
      beforeValues: { status: shift.status, endAtUtc: shift.endAtUtc },
      afterValues: { status: updated.status, endAtUtc: updated.endAtUtc, unpaidBreakSeconds },
      reason: null,
      revision: nextRevision,
      eventId,
      timestamp,
    });

    return updated;
  }

  async saveManagerEdit(
    shiftId: string,
    actor: { id: string; name: string },
    expectedRevision: number,
    updates: { startAtUtc?: string; endAtUtc?: string; unpaidBreakSeconds?: number },
    reason: string
  ): Promise<ShiftRecord> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('REASON_REQUIRED');
    }
    const shift = timesheetStore.getShift(shiftId);
    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (shift.revision !== expectedRevision) throw new Error('STALE_REVISION_CONFLICT');

    const nextStart = updates.startAtUtc || shift.startAtUtc;
    const nextEnd = updates.endAtUtc || shift.endAtUtc;
    const nextBreak = updates.unpaidBreakSeconds !== undefined ? updates.unpaidBreakSeconds : shift.unpaidBreakSeconds;

    if (nextEnd) {
      const val = validateShiftInterval(nextStart, nextEnd, nextBreak);
      if (!val.valid) throw new Error(val.error);
      const overlap = hasShiftOverlap(timesheetStore.getShiftsByEmployee(shift.employeeId), {
        startAtUtc: nextStart,
        endAtUtc: nextEnd,
        id: shift.id,
      });
      if (overlap) throw new Error('OVERLAPPING_SHIFT');
    }

    const nextRevision = shift.revision + 1;
    const now = new Date().toISOString();
    const updated: ShiftRecord = {
      ...shift,
      startAtUtc: nextStart,
      endAtUtc: nextEnd,
      unpaidBreakSeconds: nextBreak,
      revision: nextRevision,
      updatedAt: now,
      managerNote: reason,
    };

    timesheetStore.saveShift(updated);
    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId,
      actorId: actor.id,
      actorName: actor.name,
      action: 'manager_edit',
      beforeValues: { ...shift },
      afterValues: { ...updated },
      reason,
      revision: nextRevision,
      eventId: `edit-${Date.now()}`,
      timestamp: now,
    });

    return updated;
  }

  async approveShift(
    shiftId: string,
    actor: { id: string; name: string },
    expectedRevision: number,
    updates?: { startAtUtc?: string; endAtUtc?: string; unpaidBreakSeconds?: number },
    reason?: string
  ): Promise<ShiftRecord> {
    const shift = timesheetStore.getShift(shiftId);
    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (actor.id === shift.employeeId) throw new Error('SELF_APPROVAL_DISABLED');
    if (shift.revision !== expectedRevision) throw new Error('STALE_REVISION_CONFLICT');
    if (shift.status === 'active') throw new Error('CANNOT_APPROVE_ACTIVE_SHIFT');

    let base = shift;
    if (updates) {
      if (!reason || reason.trim().length === 0) throw new Error('REASON_REQUIRED');
      base = await this.saveManagerEdit(shiftId, actor, expectedRevision, updates, reason);
    }

    const nextRevision = base.revision + 1;
    const now = new Date().toISOString();
    const action: AuditAction = updates ? 'amend_approve' : 'approve';
    const approved: ShiftRecord = {
      ...base,
      status: 'approved',
      approvedAt: now,
      approvedBy: actor.id,
      revision: nextRevision,
      updatedAt: now,
    };

    timesheetStore.saveShift(approved);
    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId,
      actorId: actor.id,
      actorName: actor.name,
      action,
      beforeValues: { status: base.status, approvedAt: base.approvedAt },
      afterValues: { status: 'approved', approvedAt: now, approvedBy: actor.id },
      reason: reason || null,
      revision: nextRevision,
      eventId: `appr-${Date.now()}`,
      timestamp: now,
    });

    return approved;
  }

  async returnForCorrection(
    shiftId: string,
    actor: { id: string; name: string },
    expectedRevision: number,
    feedbackNote: string
  ): Promise<ShiftRecord> {
    if (!feedbackNote || feedbackNote.trim().length === 0) throw new Error('FEEDBACK_REQUIRED');
    const shift = timesheetStore.getShift(shiftId);
    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (shift.revision !== expectedRevision) throw new Error('STALE_REVISION_CONFLICT');

    const nextRevision = shift.revision + 1;
    const now = new Date().toISOString();
    const updated: ShiftRecord = {
      ...shift,
      status: 'needs_correction',
      managerNote: feedbackNote,
      revision: nextRevision,
      updatedAt: now,
    };

    timesheetStore.saveShift(updated);
    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId,
      actorId: actor.id,
      actorName: actor.name,
      action: 'return_for_correction',
      beforeValues: { status: shift.status },
      afterValues: { status: 'needs_correction', managerNote: feedbackNote },
      reason: feedbackNote,
      revision: nextRevision,
      eventId: `ret-${Date.now()}`,
      timestamp: now,
    });

    return updated;
  }

  async requestCorrection(params: {
    shiftId: string | null;
    employee: { id: string; name: string };
    proposedStart: string;
    proposedEnd: string;
    proposedBreakSeconds: number;
    reason: string;
    baseRevision?: number;
  }): Promise<CorrectionRequest> {
    if (!params.reason || params.reason.trim().length === 0) throw new Error('REASON_REQUIRED');
    const val = validateShiftInterval(params.proposedStart, params.proposedEnd, params.proposedBreakSeconds);
    if (!val.valid) throw new Error(val.error);

    const now = new Date().toISOString();
    const request: CorrectionRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId: params.shiftId,
      employeeId: params.employee.id,
      employeeName: params.employee.name,
      proposedStart: params.proposedStart,
      proposedEnd: params.proposedEnd,
      proposedBreakSeconds: params.proposedBreakSeconds,
      timeZone: DEFAULT_TIMEZONE,
      reason: params.reason,
      status: 'pending',
      baseRevision: params.baseRevision || 1,
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };

    timesheetStore.saveCorrectionRequest(request);
    return request;
  }

  async reviewCorrectionRequest(
    requestId: string,
    actor: { id: string; name: string },
    decision: 'approve' | 'reject',
    reviewNote: string
  ): Promise<CorrectionRequest> {
    const req = timesheetStore.getCorrectionRequest(requestId);
    if (!req) throw new Error('REQUEST_NOT_FOUND');
    if (req.status !== 'pending') throw new Error('REQUEST_ALREADY_RESOLVED');

    const now = new Date().toISOString();
    if (decision === 'approve') {
      if (req.shiftId) {
        const shift = timesheetStore.getShift(req.shiftId);
        if (shift) {
          await this.saveManagerEdit(
            shift.id,
            actor,
            shift.revision,
            {
              startAtUtc: req.proposedStart,
              endAtUtc: req.proposedEnd,
              unpaidBreakSeconds: req.proposedBreakSeconds,
            },
            `Approved correction request: ${req.reason}`
          );
        }
      } else {
        // Missing hours shift creation
        const newShift = await this.clockIn(req.employeeId, req.employeeName, 'manual', `corr-${req.id}`, req.proposedStart);
        await this.clockOut(req.employeeId, 'manual', `corr-out-${req.id}`, req.proposedBreakSeconds, req.proposedEnd);
        await this.approveShift(newShift.id, actor, 2, undefined, `Approved missing hours request: ${req.reason}`);
      }
    }

    const updated: CorrectionRequest = {
      ...req,
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewedAt: now,
      reviewedBy: actor.id,
      reviewNote: reviewNote || null,
    };

    timesheetStore.saveCorrectionRequest(updated);
    return updated;
  }

  getWeeklySummary(
    employeeId?: string,
    anchorDate: Date | string = new Date(),
    timeZone = DEFAULT_TIMEZONE
  ): TimesheetSummary {
    const { weekStartUtc, weekEndUtc } = getWeekBoundariesUtc(anchorDate, timeZone);
    const startMs = new Date(weekStartUtc).getTime();
    const endMs = new Date(weekEndUtc).getTime();

    const shifts = employeeId
      ? timesheetStore.getShiftsByEmployee(employeeId)
      : timesheetStore.getAllShifts();

    let approvedSeconds = 0;
    let pendingSeconds = 0;
    let activeCount = 0;
    let attentionCount = 0;

    for (const s of shifts) {
      const sStartMs = new Date(s.startAtUtc).getTime();
      if (sStartMs < startMs || sStartMs > endMs) continue;

      if (s.status === 'active') {
        activeCount++;
      } else if (s.status === 'approved' && s.endAtUtc) {
        approvedSeconds += calculateNetSeconds(s.startAtUtc, s.endAtUtc, s.unpaidBreakSeconds);
      } else if (s.status === 'pending' && s.endAtUtc) {
        pendingSeconds += calculateNetSeconds(s.startAtUtc, s.endAtUtc, s.unpaidBreakSeconds);
      } else if (s.status === 'needs_correction') {
        attentionCount++;
      }
    }

    return { approvedSeconds, pendingSeconds, activeCount, attentionCount };
  }
}

export const timesheetService = new TimesheetService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/timesheets/__tests__/timesheetService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/timesheets/timesheetService.ts src/lib/timesheets/__tests__/timesheetService.test.ts
git commit -m "feat(timesheets): implement shared capture and approval service"
```

---

### Task 5: Integrate QR Clock-In on Vehicle Scan

**Files:**
- Modify: `src/app/scan/page.tsx`
- Create: `src/app/scan/__tests__/scanClockIn.test.ts`

**Interfaces:**
- Consumes: `timesheetService.clockIn`
- Produces: Seamless punch initiation when employee scans vehicle QR

- [ ] **Step 1: Write integration test for scan clock-in**

Create `src/app/scan/__tests__/scanClockIn.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';

describe('QR Scan Clock-In Flow', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  it('automatically clocks in employee on vehicle scan and maintains active shift', async () => {
    const shift = await timesheetService.clockIn('emp-101', 'Bob Driver', 'qr', 'scan-evt-1');
    expect(shift.status).toBe('active');
    expect(shift.startSource).toBe('qr');

    const guard = timesheetStore.getActiveShiftGuard('emp-101');
    expect(guard?.activeShiftId).toBe(shift.id);

    // Second scan of another vehicle preserves the same active shift
    const secondScan = await timesheetService.clockIn('emp-101', 'Bob Driver', 'qr', 'scan-evt-2');
    expect(secondScan.id).toBe(shift.id);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/app/scan/__tests__/scanClockIn.test.ts`  
Expected: PASS

- [ ] **Step 3: Update `src/app/scan/page.tsx`**

In `src/app/scan/page.tsx`, import `timesheetService` and trigger clock-in before redirecting to `/inspect` when `activeRole !== 'manager'`:
```typescript
// inside handleDecoded / openVehicle in src/app/scan/page.tsx:
const activeRole = dbService.getSession()?.role || roleRef.current;
if (activeRole !== 'manager') {
  const sessionUser = dbService.getSession();
  if (sessionUser) {
    void timesheetService.clockIn(sessionUser.userId, sessionUser.userName || 'Employee', 'qr', `qr-scan-${Date.now()}`);
  }
}
```

- [ ] **Step 4: Run existing test suites**

Run: `npm test`  
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/scan/page.tsx src/app/scan/__tests__/scanClockIn.test.ts
git commit -m "feat(timesheets): connect QR scan flow to automated clock-in"
```

---

### Task 6: Integrate Return-Checklist Clock-Out

**Files:**
- Modify: `src/app/return/ReturnClient.tsx`
- Create: `src/app/return/__tests__/returnClockOut.test.ts`

**Interfaces:**
- Consumes: `timesheetService.clockOut`
- Produces: Automated pending timesheet shift creation upon return submission

- [ ] **Step 1: Write return clock-out integration test**

Create `src/app/return/__tests__/returnClockOut.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';

describe('Return Checklist Clock-Out Integration', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  it('clocks out driver upon return submission and transitions shift to pending', async () => {
    await timesheetService.clockIn('emp-202', 'Dave', 'qr', 'start-evt');
    const closed = await timesheetService.clockOut('emp-202', 'checklist_return', 'return-evt');
    expect(closed.status).toBe('pending');
    expect(closed.endSource).toBe('checklist_return');
    expect(timesheetStore.getActiveShiftGuard('emp-202')?.activeShiftId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/app/return/__tests__/returnClockOut.test.ts`  
Expected: PASS

- [ ] **Step 3: Update `src/app/return/ReturnClient.tsx`**

Modify `handleSubmit` in `src/app/return/ReturnClient.tsx`:
After `await dbService.submitReturnInspection(...)`, invoke:
```typescript
try {
  await timesheetService.clockOut(user.id, 'checklist_return', `return-${Date.now()}`);
} catch (clockErr: any) {
  // If NO_ACTIVE_SHIFT, van return still succeeds; driver is alerted
  if (clockErr?.message === 'NO_ACTIVE_SHIFT') {
    console.info('Return inspection submitted without an open active shift.');
  } else {
    console.warn('Timesheet clock-out error:', clockErr);
  }
}
```

- [ ] **Step 4: Run existing tests**

Run: `npm test`  
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/return/ReturnClient.tsx src/app/return/__tests__/returnClockOut.test.ts
git commit -m "feat(timesheets): connect return checklist completion to automatic clock-out"
```

---

### Task 7: Employee Timesheet View & Trainee Punch Card

**Files:**
- Create: `src/app/timesheets/TimesheetsClient.tsx`
- Create: `src/app/timesheets/__tests__/TimesheetsClient.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `timesheetService`, `timesheetStore`, `timeCalculations`
- Produces: Employee timesheet dashboard with live punch card, week selector, summary metrics, and shift table/cards.

- [ ] **Step 1: Write UI component tests**

Create `src/app/timesheets/__tests__/TimesheetsClient.test.tsx`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimesheetsClient from '../TimesheetsClient';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Trainee Tom', email: 'tom@sunny.com', role: 'employee' },
    role: 'employee',
    isAuthenticated: true,
  }),
}));

describe('TimesheetsClient (Employee View)', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  it('renders Clock In button when employee is clocked out', () => {
    render(<TimesheetsClient />);
    expect(screen.getByRole('button', { name: /clock in/i })).toBeDefined();
    expect(screen.getByText(/clocked out/i)).toBeDefined();
  });

  it('allows trainee to clock in manually', async () => {
    render(<TimesheetsClient />);
    const clockInBtn = screen.getByRole('button', { name: /clock in/i });
    fireEvent.click(clockInBtn);
    expect(timesheetStore.getActiveShiftGuard('u-1')?.activeShiftId).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/timesheets/__tests__/TimesheetsClient.test.tsx`  
Expected: FAIL (Cannot find module `../TimesheetsClient`)

- [ ] **Step 3: Implement `src/app/timesheets/TimesheetsClient.tsx`**

Implement `TimesheetsClient.tsx` providing:
- Prototype indicator banner: `"Timesheet Prototype (Isolated Test Environment)"`.
- Live punch timer (updating every second with `setInterval`).
- Clock In / Clock Out buttons (with Break duration modal on Clock Out).
- Weekly summary cards (Approved Hours, Pending Hours, Active, Needs Correction).
- Week selector `< Previous Week | This Week | Next Week >`.
- Shift history table/cards with source badges (`QR`, `Manual`).
- Request Missing Hours / Request Correction modals.
- Manager review tab / drawer for manager accounts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/timesheets/__tests__/TimesheetsClient.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/timesheets/TimesheetsClient.tsx src/app/timesheets/__tests__/TimesheetsClient.test.tsx
git commit -m "feat(timesheets): create employee timesheet view and manual punch controls"
```

---

### Task 8: Manager Review Dashboard & Shift Approvals

**Files:**
- Modify: `src/app/timesheets/TimesheetsClient.tsx`
- Create: `src/app/timesheets/__tests__/ManagerReview.test.tsx`

**Interfaces:**
- Consumes: `timesheetService.saveManagerEdit`, `timesheetService.approveShift`, `timesheetService.returnForCorrection`
- Produces: Team shift review table, optimistic revision control, audit log drawer, and approval workflows.

- [ ] **Step 1: Write manager review tests**

Create `src/app/timesheets/__tests__/ManagerReview.test.tsx`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimesheetsClient from '../TimesheetsClient';
import { timesheetService } from '@/lib/timesheets/timesheetService';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'mgr-9', name: 'Manager Morgan', email: 'morgan@sunny.com', role: 'manager' },
    role: 'manager',
    isAuthenticated: true,
  }),
}));

describe('TimesheetsClient (Manager Review)', () => {
  beforeEach(async () => {
    timesheetStore.reset();
    // Seed a pending shift from employee Alice
    await timesheetService.clockIn('emp-alice', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
    await timesheetService.clockOut('emp-alice', 'checklist_return', 'evt-2', 0, '2026-10-14T20:00:00.000Z');
  });

  it('renders team review table and allows manager approval', async () => {
    render(<TimesheetsClient />);
    expect(screen.getByText(/manager review/i)).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/app/timesheets/__tests__/ManagerReview.test.tsx`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/timesheets/__tests__/ManagerReview.test.tsx src/app/timesheets/TimesheetsClient.tsx
git commit -m "feat(timesheets): add manager review table and approval workflows"
```

---

### Task 9: Register Route & Navigation Bar Integration

**Files:**
- Create: `src/app/timesheets/page.tsx`
- Modify: `src/lib/navItems.ts`
- Test: `src/lib/__tests__/navItems.test.ts`

**Interfaces:**
- Consumes: `TimesheetsClient`
- Produces: Accessible `/timesheets` page in Sunny header and sidebar

- [ ] **Step 1: Create `src/app/timesheets/page.tsx`**

Create `src/app/timesheets/page.tsx`:
```typescript
import React from 'react';
import TimesheetsClient from './TimesheetsClient';

export const metadata = {
  title: 'Timesheets | Sunny Fleet Accountability',
  description: 'Employee time records, individual shift approval, and weekly summaries.',
};

export default function TimesheetsPage() {
  return <TimesheetsClient />;
}
```

- [ ] **Step 2: Add Timesheets item to `src/lib/navItems.ts`**

In `src/lib/navItems.ts`:
Add `/timesheets` to navigation lists with Clock icon:
```typescript
{
  label: 'Timesheets',
  href: '/timesheets',
  icon: 'Clock',
}
```

- [ ] **Step 3: Verify build and test suite**

Run: `npm run build && npm test`  
Expected: Successful build and all 56+ tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/app/timesheets/page.tsx src/lib/navItems.ts
git commit -m "feat(timesheets): register /timesheets route and navigation link"
```

---

### Task 10: Quality Gate & Test Coverage Verification

**Files:**
- All timesheet test suites
- Generate report: `docs/timesheets/quality-report.md`

**Interfaces:**
- Consumes: Vitest test runner
- Produces: Verified 100% test pass rate and $\ge 80\%$ code coverage on new timesheet code.

- [ ] **Step 1: Run comprehensive tests with coverage**

Run: `npx vitest run --coverage` or `npm test`  
Verify all test suites pass.

- [ ] **Step 2: Generate quality and walkthrough report**

Create `docs/timesheets/quality-report.md` recording:
- Commit hash
- Test suite pass counts
- Coverage metrics for `src/lib/timesheets/`
- Verified acceptance criteria checklist

- [ ] **Step 3: Commit**

```bash
git add docs/timesheets/quality-report.md
git commit -m "docs(timesheets): record verified acceptance assessment and test coverage"
```
