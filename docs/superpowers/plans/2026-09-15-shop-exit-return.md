# Shop-Exit Return Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a printable shop-exit QR that runs a short manager-editable return checklist for the signed-in driver's van, clear occupancy on submit, create missed-return records on overnight auto-clear, and prompt catch-up after passcode login.

**Architecture:** Extend existing occupancy + checklist config. Return submissions are `Inspection` rows with `kind: 'return'`. Pure helpers in `src/lib/returnFlow.ts` resolve which van to return and whether a shift already has a return. Overnight reconcile in `dbService` clears vans and writes `MissedReturn` rows. New `/return` page reuses inspect question UI patterns. Settings gains a Return checklist editor and shop-exit QR print. `PasscodeGate` redirects employees with pending missed returns to `/return?missed=<id>`.

**Tech Stack:** Next.js 14 App Router (`output: 'export'`), TypeScript, Tailwind, Vitest + jsdom, localStorage + optional Firestore via `dbService`, `qrcode.react`, existing Auth passcode session.

**Spec:** `docs/superpowers/specs/2026-09-15-shop-exit-return-design.md`

## Global Constraints

- Respect `BASE_PATH` / `asset()` for QR URLs and static export (`/sunny` in production).
- Photos stay compressed JPEG data URLs — no Firebase Storage.
- Do not steal another driver's live checkout on pre-trip submit (existing `occupancyAfterInspection`).
- Overnight clear always runs; missed-return nags are created only by overnight auto-clear, not manager force-return.
- Employees with pending missed return: complete now or "Remind me later" once per session; managers may dismiss.
- Build on `main` (or a feature branch off current `main`); do not resurrect deleted `styling-changes`.
- TDD: failing Vitest first for lib/db helpers; `npx vitest run <file>` and `npx tsc --noEmit`.
- Frequent commits; do not commit `tsconfig.tsbuildinfo`.

## File map

| File | Responsibility |
| --- | --- |
| `src/types/index.ts` | `Inspection.kind`, `ChecklistConfig.returnQuestions`, `MissedReturn` |
| `src/lib/returnFlow.ts` | Pure: resolve van, shift return detection, default return questions |
| `src/lib/returnFlow.test.ts` | Unit tests for those helpers |
| `src/lib/occupancy.ts` / `.test.ts` | Unchanged behavior; overnight still uses `shouldAutoReturnVehicle` |
| `src/lib/db.ts` | Normalize/save return questions; missed-return CRUD; overnight creates misses; `submitReturnInspection` |
| `src/lib/missedReturns.test.ts` | Tests for overnight miss creation + complete miss (via thin exports or db with mocks) |
| `src/app/return/page.tsx` | Suspense shell like inspect |
| `src/app/return/ReturnClient.tsx` | Van resolve + short checklist + submit |
| `src/app/settings/page.tsx` | Return checklist editor + Print shop-exit QR |
| `src/components/ShopExitQRCode.tsx` | Printable `/return` QR (mirror `QRCodeDisplay` patterns) |
| `src/components/PasscodeGate.tsx` | After login, route catch-up |
| `src/context/AuthContext.tsx` | Optional session flag `returnCatchUpDeferredAt` in memory only |
| `src/app/inspections/page.tsx` | Badge/filter for `kind === 'return'` (light touch) |

---

### Task 1: Types for return kind, return questions, missed returns

**Files:**
- Modify: `src/types/index.ts`
- Test: covered by later tasks compiling / Task 2 tests importing types

**Interfaces:**
- Produces:
  - `InspectionKind = 'pretrip' | 'return'`
  - `Inspection.kind?: InspectionKind` (omit/`'pretrip'` = morning)
  - `ChecklistConfig.returnQuestions?: ChecklistQuestion[]`
  - `MissedReturn` interface as in spec

- [ ] **Step 1: Add types**

In `src/types/index.ts`, after `InspectionStatus`:

```ts
export type InspectionKind = 'pretrip' | 'return';
```

On `Inspection`, after `fuelLevel`:

```ts
  /** Morning checklist vs shop-exit return. Omitted / pretrip = morning. */
  kind?: InspectionKind;
```

On `ChecklistConfig`, after `collectFuelLevel`:

```ts
  /** Short shop-exit / post-trip questions. Defaulted in getChecklistConfig when missing. */
  returnQuestions?: ChecklistQuestion[];
```

Add:

```ts
export type MissedReturnStatus = 'pending' | 'done';

export interface MissedReturn {
  id: string;
  userId: string;
  userName: string;
  vehicleId: string;
  vehicleNumber: string;
  dateString: string;
  status: MissedReturnStatus;
  createdAt: string;
  completedAt?: string | null;
  completedReturnInspectionId?: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "types: add return inspection kind and missed-return model"
```

---

### Task 2: Pure return-flow helpers (TDD)

**Files:**
- Create: `src/lib/returnFlow.ts`
- Create: `src/lib/returnFlow.test.ts`

**Interfaces:**
- Consumes: `Vehicle`, `Inspection`, `MissedReturn`, `ChecklistQuestion` from `@/types`; `localDateString` from `./occupancy`
- Produces:
  - `DEFAULT_RETURN_QUESTIONS: ChecklistQuestion[]`
  - `normalizeReturnQuestions(questions?: ChecklistQuestion[] | null): ChecklistQuestion[]`
  - `hasReturnForShift(args: { vehicleId: string; userId: string; shiftDateString: string; inspections: Pick<Inspection,'vehicleId'|'userId'|'kind'|'dateString'|'submittedAt'>[] }): boolean`
  - `shiftDateStringForVehicle(vehicle: Pick<Vehicle,'currentUserStartAt'|'lastInspectionAt'>, now?: Date): string`
  - `resolveReturnVehicle(args: { userId: string | null | undefined; vehicles: Vehicle[]; missed?: Pick<MissedReturn,'vehicleId'> | null }): Vehicle | null`
  - `vehiclesInUse(vehicles: Vehicle[]): Vehicle[]`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/returnFlow.test.ts
import { describe, expect, it } from 'vitest';
import type { Vehicle, Inspection } from '@/types';
import {
  DEFAULT_RETURN_QUESTIONS,
  hasReturnForShift,
  normalizeReturnQuestions,
  resolveReturnVehicle,
  shiftDateStringForVehicle,
  vehiclesInUse,
} from './returnFlow';

const van = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'van-1',
  vehicleNumber: 'Van #1',
  name: 'Transit',
  licensePlate: 'ABC',
  qrCodeToken: 'van-1',
  status: 'in_use',
  currentUserId: 'sam',
  currentUserName: 'Sam',
  ...over,
});

describe('normalizeReturnQuestions', () => {
  it('falls back to defaults when missing or empty', () => {
    expect(normalizeReturnQuestions(undefined).length).toBeGreaterThan(0);
    expect(normalizeReturnQuestions([]).length).toBeGreaterThan(0);
    expect(normalizeReturnQuestions(DEFAULT_RETURN_QUESTIONS)).toEqual(DEFAULT_RETURN_QUESTIONS);
  });
});

describe('resolveReturnVehicle', () => {
  it('prefers the signed-in drivers checked-out van', () => {
    const fleet = [
      van({ id: 'van-1', currentUserId: 'alex' }),
      van({ id: 'van-2', currentUserId: 'sam', vehicleNumber: 'Van #2' }),
    ];
    expect(resolveReturnVehicle({ userId: 'sam', vehicles: fleet })?.id).toBe('van-2');
  });

  it('uses missed-return vehicle when catching up', () => {
    const fleet = [van({ id: 'van-9', currentUserId: null, status: 'active' })];
    expect(
      resolveReturnVehicle({ userId: 'sam', vehicles: fleet, missed: { vehicleId: 'van-9' } })?.id
    ).toBe('van-9');
  });

  it('returns null when signed-in user has no van and no miss', () => {
    expect(resolveReturnVehicle({ userId: 'sam', vehicles: [van({ currentUserId: 'alex' })] })).toBeNull();
  });
});

describe('hasReturnForShift', () => {
  it('is true when a return inspection exists for that user/van/day', () => {
    const inspections: Pick<Inspection, 'vehicleId' | 'userId' | 'kind' | 'dateString' | 'submittedAt'>[] = [
      {
        vehicleId: 'van-1',
        userId: 'sam',
        kind: 'return',
        dateString: '2026-09-14',
        submittedAt: '2026-09-14T23:00:00.000Z',
      },
    ];
    expect(
      hasReturnForShift({
        vehicleId: 'van-1',
        userId: 'sam',
        shiftDateString: '2026-09-14',
        inspections,
      })
    ).toBe(true);
  });

  it('ignores pretrip inspections', () => {
    expect(
      hasReturnForShift({
        vehicleId: 'van-1',
        userId: 'sam',
        shiftDateString: '2026-09-14',
        inspections: [
          {
            vehicleId: 'van-1',
            userId: 'sam',
            kind: 'pretrip',
            dateString: '2026-09-14',
            submittedAt: '2026-09-14T15:00:00.000Z',
          },
        ],
      })
    ).toBe(false);
  });
});

describe('shiftDateStringForVehicle', () => {
  it('uses local date of currentUserStartAt when present', () => {
    const now = new Date('2026-09-15T18:00:00');
    expect(
      shiftDateStringForVehicle(
        van({ currentUserStartAt: '2026-09-14T20:00:00.000Z' }),
        now
      )
    ).toMatch(/2026-09-1[45]/); // local TZ dependent — assert via occupancy localDateString in impl tests if needed
  });
});

describe('vehiclesInUse', () => {
  it('lists vans with a current driver', () => {
    expect(
      vehiclesInUse([
        van({ id: 'a', currentUserId: 'sam' }),
        van({ id: 'b', currentUserId: null, status: 'active' }),
      ]).map((v) => v.id)
    ).toEqual(['a']);
  });
});
```

Note: For `shiftDateStringForVehicle`, implement with `localDateString(new Date(vehicle.currentUserStartAt))` and test with a fixed ISO that is unambiguous in America/Los_Angeles, e.g. `2026-09-14T18:00:00.000-07:00`, or spy-free compare against `localDateString(new Date(iso))`.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/returnFlow.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/returnFlow.ts`**

```ts
import type { ChecklistQuestion, Inspection, MissedReturn, Vehicle } from '@/types';
import { localDateString } from './occupancy';

export const DEFAULT_RETURN_QUESTIONS: ChecklistQuestion[] = [
  {
    id: 'return-damage',
    text: 'Any new body damage or interior issues?',
    category: 'general',
    type: 'yes_no',
    required: true,
    order: 1,
  },
  {
    id: 'return-fuel',
    text: 'Fuel / supplies OK for the next driver?',
    category: 'general',
    type: 'yes_no',
    required: true,
    order: 2,
  },
  {
    id: 'return-notes',
    text: 'Anything else to report?',
    category: 'general',
    type: 'text',
    required: false,
    order: 3,
  },
];

export function normalizeReturnQuestions(
  questions?: ChecklistQuestion[] | null
): ChecklistQuestion[] {
  if (questions && questions.length > 0) return questions;
  return DEFAULT_RETURN_QUESTIONS;
}

export function vehiclesInUse(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter((v) => Boolean(v.currentUserId));
}

export function resolveReturnVehicle(args: {
  userId: string | null | undefined;
  vehicles: Vehicle[];
  missed?: Pick<MissedReturn, 'vehicleId'> | null;
}): Vehicle | null {
  const { userId, vehicles, missed } = args;
  if (missed?.vehicleId) {
    return vehicles.find((v) => v.id === missed.vehicleId) || null;
  }
  if (!userId) return null;
  const mine = vehicles.filter((v) => v.currentUserId === userId);
  if (mine.length === 1) return mine[0];
  if (mine.length > 1) return mine[0];
  return null;
}

export function shiftDateStringForVehicle(
  vehicle: Pick<Vehicle, 'currentUserStartAt' | 'lastInspectionAt'>,
  now = new Date()
): string {
  if (vehicle.currentUserStartAt) {
    const d = new Date(vehicle.currentUserStartAt);
    if (!Number.isNaN(d.getTime())) return localDateString(d);
  }
  if (vehicle.lastInspectionAt) {
    const d = new Date(vehicle.lastInspectionAt);
    if (!Number.isNaN(d.getTime())) return localDateString(d);
  }
  return localDateString(now);
}

export function hasReturnForShift(args: {
  vehicleId: string;
  userId: string;
  shiftDateString: string;
  inspections: Pick<Inspection, 'vehicleId' | 'userId' | 'kind' | 'dateString' | 'submittedAt'>[];
}): boolean {
  const { vehicleId, userId, shiftDateString, inspections } = args;
  return inspections.some((insp) => {
    if (insp.vehicleId !== vehicleId || insp.userId !== userId) return false;
    if (insp.kind !== 'return') return false;
    if (insp.dateString === shiftDateString) return true;
    if (!insp.submittedAt) return false;
    return localDateString(new Date(insp.submittedAt)) === shiftDateString;
  });
}
```

Adjust `ChecklistQuestion` fields if the real type requires more (`helperText`, etc.) — match existing `INITIAL_CHECKLIST_QUESTIONS` shape in `db.ts` / seed data.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/returnFlow.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/returnFlow.ts src/lib/returnFlow.test.ts
git commit -m "feat: add return-flow helpers for shop-exit checklist"
```

---

### Task 3: ChecklistConfig returnQuestions in dbService

**Files:**
- Modify: `src/lib/db.ts` (`getChecklistConfig`, `resetToDefaults` initialConfig, add `saveReturnQuestions`)
- Create: `src/lib/checklistConfig.return.test.ts` (mock firebase like `appSettings.test.ts`)

**Interfaces:**
- Consumes: `normalizeReturnQuestions` from `./returnFlow`
- Produces: `getChecklistConfig()` always returns non-empty `returnQuestions`; `saveReturnQuestions(questions)`

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '@/lib/db';
import { DEFAULT_RETURN_QUESTIONS } from '@/lib/returnFlow';

vi.mock('@/lib/firebase', () => ({ db: null, ensureAuth: vi.fn().mockResolvedValue(null) }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(),
  getDoc: vi.fn(), getDocs: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn(),
}));

describe('returnQuestions config', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults returnQuestions when config omits them', () => {
    const cfg = dbService.getChecklistConfig();
    expect(cfg.returnQuestions?.length).toBeGreaterThan(0);
    expect(cfg.returnQuestions?.[0].id).toBe(DEFAULT_RETURN_QUESTIONS[0].id);
  });
});
```

- [ ] **Step 2: Run — FAIL or assert wrong until normalize wired**

```bash
npx vitest run src/lib/checklistConfig.return.test.ts
```

- [ ] **Step 3: Implement**

In `getChecklistConfig` parsed return:

```ts
return {
  ...parsed,
  collectOdometer: parsed.collectOdometer !== false,
  collectFuelLevel: parsed.collectFuelLevel !== false,
  returnQuestions: normalizeReturnQuestions(parsed.returnQuestions),
};
```

Same for the no-raw fallback and SSR stub. In `resetToDefaults` `initialConfig`, set `returnQuestions: DEFAULT_RETURN_QUESTIONS`.

Add:

```ts
public async saveReturnQuestions(questions: ChecklistQuestion[]): Promise<void> {
  const config = this.getChecklistConfig();
  await this.saveChecklistConfig({
    ...config,
    returnQuestions: questions,
  });
}
```

Import `normalizeReturnQuestions`, `DEFAULT_RETURN_QUESTIONS` from `./returnFlow`.

- [ ] **Step 4: Tests PASS + commit**

```bash
npx vitest run src/lib/checklistConfig.return.test.ts
git add src/lib/db.ts src/lib/checklistConfig.return.test.ts
git commit -m "feat: persist manager-editable return checklist questions"
```

---

### Task 4: Missed returns + overnight creation

**Files:**
- Modify: `src/lib/db.ts` (`STORAGE_KEYS.MISSED_RETURNS`, CRUD, `reconcileOvernightCheckins`)
- Create: `src/lib/missedReturns.test.ts`

**Interfaces:**
- Produces:
  - `getMissedReturns(): MissedReturn[]`
  - `getPendingMissedReturnForUser(userId: string): MissedReturn | undefined`
  - `completeMissedReturn(id: string, returnInspectionId: string): Promise<void>`
  - Overnight: for each stale vehicle with `currentUserId`, if `!hasReturnForShift(...)`, append pending `MissedReturn`, then clear vans

- [ ] **Step 1: Failing test** — seed a van checked out yesterday with a pretrip only; call a testable path.

Because `reconcileOvernightCheckins` is private, either:
- export a package-level `buildMissedReturnForClearedVehicle(...)` in `returnFlow.ts`, **or**
- trigger via `getVehicles()` after planting localStorage.

Prefer planting localStorage + `getVehicles()`:

```ts
it('creates a pending missed return when overnight-clearing a van without a return', () => {
  // seed STORAGE vehicles with currentUserStartAt yesterday, inspections pretrip only
  // call dbService.getVehicles()
  // expect getPendingMissedReturnForUser('sam') to be defined
  // expect vehicle.currentUserId to be null
});
```

- [ ] **Step 2: Implement STORAGE_KEYS + methods + overnight hook**

```ts
MISSED_RETURNS: 'sunny_missed_returns',
```

In `reconcileOvernightCheckins`, before clearing:

```ts
const inspections = this.getInspections(); // careful: getInspections must not re-enter overnight
const existingMisses = this.getMissedReturns();
const newMisses: MissedReturn[] = [];
for (const v of stale) {
  if (!v.currentUserId) continue;
  const shiftDay = shiftDateStringForVehicle(v);
  if (hasReturnForShift({ vehicleId: v.id, userId: v.currentUserId, shiftDateString: shiftDay, inspections })) {
    continue;
  }
  newMisses.push({
    id: `miss-${v.id}-${shiftDay}-${v.currentUserId}`,
    userId: v.currentUserId,
    userName: v.currentUserName || 'Driver',
    vehicleId: v.id,
    vehicleNumber: v.vehicleNumber,
    dateString: shiftDay,
    status: 'pending',
    createdAt: new Date().toISOString(),
    completedAt: null,
    completedReturnInspectionId: null,
  });
}
// dedupe by id against existingMisses; write localStorage + optional Firestore collection missedReturns
```

Use `readVehicleList` / raw inspection read inside reconcile to avoid recursion. If `getInspections()` calls something that calls `getVehicles()`, read inspections JSON directly.

- [ ] **Step 3: Tests PASS + commit**

```bash
npx vitest run src/lib/missedReturns.test.ts
git add src/lib/db.ts src/lib/missedReturns.test.ts
git commit -m "feat: record missed returns when overnight clearing vans"
```

---

### Task 5: `submitReturnInspection`

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/missedReturns.test.ts` or new `src/lib/submitReturn.test.ts`

**Interfaces:**
- Produces: `submitReturnInspection(data: { vehicleId; userId; userName; userEmail; responses; generalNotes?; photoUrls?; missedReturnId?: string | null }): { inspection: Inspection }`
  - Sets `kind: 'return'`, does **not** checkout, calls `checkInVehicle` / `checkInFields` + persist
  - If `missedReturnId`, complete that miss

- [ ] **Step 1: Failing test** — submit return clears `currentUserId` and sets `kind: 'return'`.

- [ ] **Step 2: Implement** mirroring `submitInspection` but skip issue/checkout-on-free logic; always check in; set `kind: 'return'`.

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "feat: submit shop-exit return inspection and clear occupancy"
```

---

### Task 6: `/return` page UI

**Files:**
- Create: `src/app/return/page.tsx` (copy Suspense pattern from `src/app/inspect/page.tsx`)
- Create: `src/app/return/ReturnClient.tsx`

**Interfaces:**
- Consumes: `resolveReturnVehicle`, `vehiclesInUse`, `normalizeReturnQuestions`, `dbService.submitReturnInspection`, `useAuth`, `useSearchParams` (`missed` id)

- [ ] **Step 1: Scaffold page.tsx** identical structure to inspect, loading `ReturnClient`.

- [ ] **Step 2: Implement ReturnClient**
  - Load missed row if `?missed=`
  - Resolve van; if null, show In use list + link to `/scan`
  - Render `returnQuestions` with same control types as InspectClient (pass_fail / yes_no / text / photo minimal set)
  - Use `canSubmitInspection` from `inspectionValidation`
  - Submit → success card “Returned · {vehicleNumber} available.”
  - Catch-up copy when missed: “You forgot to sign out of {vehicleNumber}…”

Keep this file focused; do not import all of InspectClient. Copy only the small response-widget patterns needed for DEFAULT_RETURN_QUESTIONS types.

- [ ] **Step 3: Manual check** — `npm run dev`, open `/return`.

- [ ] **Step 4: Commit**

```bash
git add src/app/return
git commit -m "feat: add shop-exit /return checklist page"
```

---

### Task 7: Settings — edit return questions + print shop-exit QR

**Files:**
- Create: `src/components/ShopExitQRCode.tsx`
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- `ShopExitQRCode` encodes `${origin}${BASE_PATH}/return` (same origin pattern as `QRCodeDisplay`)
- Settings section **Return checklist** lists `returnQuestions`, add/edit/delete via existing question modal patterns if possible; `saveReturnQuestions`
- **Print shop-exit QR** button

- [ ] **Step 1: Implement ShopExitQRCode** by adapting `QRCodeDisplay` print HTML; title “Shop exit — return van”; URL `/return` only.

- [ ] **Step 2: Settings UI** under Inspection Questions block — second card “Return checklist (shop exit)” bound to `config.returnQuestions`, save through `dbService.saveReturnQuestions`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ShopExitQRCode.tsx src/app/settings/page.tsx
git commit -m "feat: settings editor and printable shop-exit QR"
```

---

### Task 8: Passcode catch-up gate

**Files:**
- Modify: `src/components/PasscodeGate.tsx`
- Modify: `src/context/AuthContext.tsx` (optional deferred flag)

**Interfaces:**
- After successful `loginWithPasscode` in `PasscodeGate`, if `role !== 'manager'` (effective employee) and `getPendingMissedReturnForUser(user.id)`:
  - Primary: `router.replace(/return?missed=${id})` 
  - Secondary button path: sessionStorage key `sunny_return_defer_${userId}_${date}` for “Remind me later” once per local day/session
- Managers: optional dismiss without defer complexity

- [ ] **Step 1: Change PasscodePad onSuccess** for the gate to run catch-up routing (needs `useRouter`, `useAuth().user` after login — read user from `dbService.getSession()` immediately after success).

```ts
const session = dbService.getSession();
const pending = session ? dbService.getPendingMissedReturnForUser(session.userId) : undefined;
if (pending && session.role !== 'manager') {
  const deferKey = `sunny_return_defer_${session.userId}`;
  if (sessionStorage.getItem(deferKey) !== '1') {
    router.replace(`${BASE_PATH or next router}/return?missed=${pending.id}`);
    // next/router already knows basePath
    return;
  }
}
```

Use `useRouter().replace(\`/return?missed=${pending.id}\`)` — Next prepends basePath for router navigations.

- [ ] **Step 2: On `/return` catch-up**, offer “Remind me later” that sets sessionStorage and goes `/home` or `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PasscodeGate.tsx src/app/return/ReturnClient.tsx src/context/AuthContext.tsx
git commit -m "feat: prompt missed return checklist after passcode login"
```

---

### Task 9: Inspections list — show return kind

**Files:**
- Modify: `src/app/inspections/page.tsx`

- [ ] **Step 1:** Badge `Return` when `insp.kind === 'return'`; optional filter chip Pre-trip / Return / All (default All).

- [ ] **Step 2: Commit**

```bash
git add src/app/inspections/page.tsx
git commit -m "feat: badge return inspections in history"
```

---

### Task 10: Verification

- [ ] **Step 1:** `npx vitest run src/lib/returnFlow.test.ts src/lib/checklistConfig.return.test.ts src/lib/missedReturns.test.ts src/lib/occupancy.test.ts`
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3:** Manual script — checkout via inspect, open `/return`, submit, confirm Available; plant yesterday checkout, reload, confirm miss + login redirect.
- [ ] **Step 4:** Push feature branch; open compare URL if `gh` unavailable.

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Shop-exit QR → `/return` | 6, 7 |
| Short manager-editable return questions | 2, 3, 7 |
| Resolve signed-in van / In use fallback | 2, 6 |
| Submit clears occupancy | 5, 6 |
| Overnight clear + missed return | 4 |
| Morning passcode catch-up | 8 |
| Manager force-return does not create miss | 4 |
| No Firebase Storage | 5, 6 (data URLs only) |
| Return records distinguishable | 1, 5, 9 |

## Placeholder scan

None intentional. If `ChecklistQuestion` requires extra fields beyond the stub in Task 2, copy from `INITIAL_CHECKLIST_QUESTIONS` in `src/lib/db.ts` / seed module at implement time.
