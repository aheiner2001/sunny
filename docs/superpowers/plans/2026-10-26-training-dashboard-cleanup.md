# Training Dashboard Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `/training` into role-split views (employee certify, trainer sign-off queue, manager People + Needs attention + Miss strikes + Curriculum) while keeping dual sign-off and folding assign-all into person detail.

**Architecture:** Pure helpers in `src/lib/training/` drive attention buckets and trainer queues. `src/app/training/page.tsx` orchestrates `dbService` actions and renders role-specific presentational components under `src/components/training/`. Domain functions (`applyTrainerSignOff`, `applyTraineeCertify`, `buildOnboardingAssignments`, etc.) stay unchanged; UI copy drops “Onboarding.”

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest + Testing Library, existing `dbService` / Firestore patterns.

## Global Constraints

- Branch `october-26-changes` only — never merge to `main`.
- Spec: `docs/superpowers/specs/2026-10-26-training-dashboard-cleanup-design.md`.
- Dual sign-off stays: trainer → `awaiting_trainee` → trainee certify → `completed`. Manager never certifies as the employee.
- No email/SMS. No partial step-picker on assign (always all missing active steps).
- Do not show on manager view: My training, Onboarding section, Learn chart, All assignments, standalone Trainers card, four-stat strip, long how-to card.
- UI label for former onboard: **Assign missing steps** (keep `buildOnboardingAssignments` in code).

---

## File map

| Responsibility | Path |
| --- | --- |
| Attention buckets helper | Create `src/lib/training/trainingAttention.ts` |
| Attention + trainer-queue tests | Create `src/lib/training/__tests__/trainingAttention.test.ts` |
| Cloud hydration (if not already committed) | Modify `src/lib/db.ts` listeners + `saveTrainingItems` orphan delete; `src/lib/training/__tests__/trainingPersistence.test.ts` |
| Presentational pieces | Create `src/components/training/MyTrainingSection.tsx`, `TrainerSignOffQueue.tsx`, `PeopleOverview.tsx`, `PersonTrainingPanel.tsx`, `NeedsAttentionSection.tsx` (Miss strikes + Curriculum can stay inline or thin wrappers) |
| Page orchestration | Rewrite `src/app/training/page.tsx` |
| Page tests | Modify `src/app/training/__tests__/trainingPageActions.test.tsx`; add role-view coverage |
| Unused chart | Stop importing `src/components/TrainingLearnChart.tsx` from the page (leave file; do not delete unless unused elsewhere) |

---

### Task 1: Attention buckets + trainer queue helpers (TDD)

**Files:**
- Create: `src/lib/training/trainingAttention.ts`
- Create: `src/lib/training/__tests__/trainingAttention.test.ts`

**Interfaces:**
- Consumes: `TrainingAssignment` from `src/lib/training/types.ts`
- Produces:
  - `export type TrainingAttentionBucket = 'awaiting_trainer' | 'awaiting_employee' | 'needs_retrain'`
  - `export type TrainingAttentionRow = { bucket: TrainingAttentionBucket; assignment: TrainingAssignment }`
  - `export function buildTrainingAttentionRows(assignments: TrainingAssignment[]): TrainingAttentionRow[]`
  - `export function buildTrainerSignOffQueue(input: { assignments: TrainingAssignment[]; trainerId: string; links: Array<{ traineeId: string; trainerIds: string[] }> }): TrainingAssignment[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildTrainingAttentionRows, buildTrainerSignOffQueue } from '../trainingAttention';
import type { TrainingAssignment } from '../types';

const base = (overrides: Partial<TrainingAssignment>): TrainingAssignment => ({
  id: 'a1',
  traineeId: 'emp-2',
  traineeName: 'Sam',
  itemId: 'item-1',
  status: 'assigned',
  dueAt: null,
  missStreak: 0,
  events: [],
  createdAt: '2026-10-26T12:00:00Z',
  updatedAt: '2026-10-26T12:00:00Z',
  ...overrides,
});

describe('buildTrainingAttentionRows', () => {
  it('buckets assigned/overdue as awaiting_trainer, awaiting_trainee as awaiting_employee, needs_retrain separately', () => {
    const rows = buildTrainingAttentionRows([
      base({ id: '1', status: 'assigned' }),
      base({ id: '2', status: 'overdue' }),
      base({ id: '3', status: 'awaiting_trainee' }),
      base({ id: '4', status: 'needs_retrain' }),
      base({ id: '5', status: 'completed' }),
    ]);
    expect(rows.map(r => [r.assignment.id, r.bucket])).toEqual([
      ['4', 'needs_retrain'],
      ['2', 'awaiting_trainer'],
      ['1', 'awaiting_trainer'],
      ['3', 'awaiting_employee'],
    ]);
  });
});

describe('buildTrainerSignOffQueue', () => {
  it('returns only paired trainees needing trainer sign-off', () => {
    const queue = buildTrainerSignOffQueue({
      trainerId: 'emp-1',
      links: [{ traineeId: 'emp-2', trainerIds: ['emp-1'] }],
      assignments: [
        base({ id: 'keep', traineeId: 'emp-2', status: 'assigned' }),
        base({ id: 'other', traineeId: 'emp-3', status: 'assigned' }),
        base({ id: 'waiting', traineeId: 'emp-2', status: 'awaiting_trainee' }),
      ],
    });
    expect(queue.map(a => a.id)).toEqual(['keep']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/training/__tests__/trainingAttention.test.ts`

Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Write minimal implementation**

```ts
import type { TrainingAssignment, TraineeTrainerLink } from './types';

export type TrainingAttentionBucket = 'awaiting_trainer' | 'awaiting_employee' | 'needs_retrain';

export type TrainingAttentionRow = {
  bucket: TrainingAttentionBucket;
  assignment: TrainingAssignment;
};

const BUCKET_ORDER: Record<TrainingAttentionBucket, number> = {
  needs_retrain: 0,
  awaiting_trainer: 1,
  awaiting_employee: 2,
};

export function buildTrainingAttentionRows(
  assignments: TrainingAssignment[],
): TrainingAttentionRow[] {
  const out: TrainingAttentionRow[] = [];
  for (const assignment of assignments) {
    if (assignment.status === 'needs_retrain') {
      out.push({ bucket: 'needs_retrain', assignment });
    } else if (assignment.status === 'assigned' || assignment.status === 'overdue') {
      out.push({ bucket: 'awaiting_trainer', assignment });
    } else if (assignment.status === 'awaiting_trainee') {
      out.push({ bucket: 'awaiting_employee', assignment });
    }
  }
  return out.sort(
    (a, b) =>
      BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
      a.assignment.traineeName.localeCompare(b.assignment.traineeName),
  );
}

export function buildTrainerSignOffQueue(input: {
  assignments: TrainingAssignment[];
  trainerId: string;
  links: Pick<TraineeTrainerLink, 'traineeId' | 'trainerIds'>[];
}): TrainingAssignment[] {
  const paired = new Set(
    input.links.filter(l => l.trainerIds.includes(input.trainerId)).map(l => l.traineeId),
  );
  return input.assignments.filter(
    a =>
      paired.has(a.traineeId) &&
      (a.status === 'assigned' || a.status === 'overdue'),
  );
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run: `npx vitest run src/lib/training/__tests__/trainingAttention.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/trainingAttention.ts src/lib/training/__tests__/trainingAttention.test.ts
git commit -m "feat(training): add attention buckets and trainer sign-off queue helpers"
```

---

### Task 2: Commit Firestore training hydration (prerequisite on branch)

**Files:**
- Modify: `src/lib/db.ts` (`setupFirestoreListeners` for `trainingItems`, `trainingAssignments`, `traineeTrainers`, `previousUserFlags`; `saveTrainingItems` orphan deletes; include training collections in `syncAllToFirestore` if not already)
- Modify: `src/lib/training/__tests__/trainingPersistence.test.ts` (`getDocs` empty snapshot + `batch.delete` mock)

**Interfaces:**
- Consumes: existing `STORAGE_KEYS` + `onSnapshot` / `getDocs` patterns already used for vehicles
- Produces: localStorage hydrated on load so curriculum survives new previews

- [ ] **Step 1: Verify persistence tests pass with current working tree**

Run: `npx vitest run src/lib/training/__tests__/trainingPersistence.test.ts`

Expected: PASS (fix mocks if `getDocs`/`forEach` still broken)

- [ ] **Step 2: Confirm listeners exist** in `setupFirestoreListeners` for all four collections named above; if missing, add the same pattern as other collections (`!snapshot.empty || FIREBASE_SYNCED`).

- [ ] **Step 3: Commit only hydration-related files**

```bash
git add src/lib/db.ts src/lib/training/__tests__/trainingPersistence.test.ts
git commit -m "fix(training): hydrate curriculum and assignments from Firestore listeners"
```

---

### Task 3: Presentational components (no page wiring yet)

**Files:**
- Create: `src/components/training/MyTrainingSection.tsx`
- Create: `src/components/training/TrainerSignOffQueue.tsx`
- Create: `src/components/training/PeopleOverview.tsx`
- Create: `src/components/training/PersonTrainingPanel.tsx`
- Create: `src/components/training/NeedsAttentionSection.tsx`
- Test: extend `src/app/training/__tests__/trainingPageActions.test.tsx` in Task 4 (components are covered via page tests; optional shallow render not required)

**Interfaces:**
- Consumes: `buildTrainingAttentionRows`, `trainingStatusLabel` / `trainingStatusTone`, `employeeOverview*` from `trainingProgress`, `TraineeLearnRow`, types
- Produces: dumb components with callbacks only — no `dbService` calls inside

Props (exact):

```ts
// MyTrainingSection
{
  userName: string;
  rows: TrainingAssignment[];
  itemsById: Map<string, TrainingItem>;
  busy: boolean;
  onCertify: (row: TrainingAssignment) => void;
}

// TrainerSignOffQueue
{
  rows: TrainingAssignment[];
  itemsById: Map<string, TrainingItem>;
  busy: boolean;
  onSignOff: (row: TrainingAssignment) => void;
}

// PeopleOverview
{
  learnRows: TraineeLearnRow[];
  selectedId: string | null;
  onSelect: (traineeId: string) => void;
}

// PersonTrainingPanel
{
  trainee: { id: string; name: string };
  activeItems: TrainingItem[];
  assignments: TrainingAssignment[];
  trainers: Array<{ id: string; name: string }>;
  pairedTrainerIds: string[];
  pairTrainerId: string;
  onPairTrainerIdChange: (id: string) => void;
  busy: boolean;
  canTrain: boolean;
  onAssignMissing: () => void;
  onMarkTrained: (itemId: string) => void;
  onRequireRetrain: (itemId: string) => void;
  onTrainerSignOff: (row: TrainingAssignment) => void;
  onPairTrainer: () => void;
}

// NeedsAttentionSection
{
  rows: TrainingAttentionRow[];
  itemsById: Map<string, TrainingItem>;
  busy: boolean;
  canTrain: boolean;
  onSignOff: (row: TrainingAssignment) => void;
  onApproveRetrain: (row: TrainingAssignment) => void;
  onOpenPerson: (traineeId: string) => void;
}
```

- [ ] **Step 1: Implement `MyTrainingSection`** — heading “My training”; list steps; button **I was trained — certify** only when `status === 'awaiting_trainee'`; empty state when no rows.

- [ ] **Step 2: Implement `TrainerSignOffQueue`** — heading “Sign-off queue”; **Trainer sign-off** for each row.

- [ ] **Step 3: Implement `PeopleOverview`** — grid of people with overview badge + completed/total; selecting a row calls `onSelect` (selected row visually highlighted). No “Onboard…” button.

- [ ] **Step 4: Implement `PersonTrainingPanel`** — title with trainee name; primary **Assign missing steps**; per active item status + Mark trained / Require retrain / Trainer sign-off as allowed; trainer pair select + Pair button. Never use the word “Onboard” / “Onboarding”.

- [ ] **Step 5: Implement `NeedsAttentionSection`** — short dual-sign-off hint (one line); group or badge counts for the three buckets; awaiting employee rows show “Waiting on {name}” with no certify button; awaiting trainer offers sign-off when `canTrain` else “Open person”; needs_retrain offers Approve retrain.

- [ ] **Step 6: Commit**

```bash
git add src/components/training
git commit -m "feat(training): add role-split presentational sections"
```

---

### Task 4: Rewire `page.tsx` to role-split layout

**Files:**
- Modify: `src/app/training/page.tsx` (full layout rewrite; keep existing action handlers, rename onboard handler to `assignMissingSteps`)

**Interfaces:**
- Consumes: components from Task 3 + helpers from Task 1 + existing domain/db APIs
- Produces: role views matching the spec

- [ ] **Step 1: Replace state** — drop `onboardTraineeId`; keep `selectedEmployeeId` (was `reviewEmployeeId`) as the open person; keep pair fields for the person panel.

- [ ] **Step 2: Manager render tree** (in order):

1. `PageHeader` subtitle: `People status, dual sign-off progress, and curriculum.`
2. Message / error
3. `PeopleOverview` + conditional `PersonTrainingPanel` when `selectedEmployeeId` set
4. `NeedsAttentionSection`
5. Existing miss-strikes block (keep logic; title unchanged)
6. Existing curriculum block (`CurriculumSortList`)

Remove: stats strip, how-to card, Onboarding section, Employee training section (merged into panel), Learn chart, Trainers section, All assignments, My training (manager only).

- [ ] **Step 3: Non-manager render tree**

- If `user.isDesignatedTrainer`: `TrainerSignOffQueue` with `buildTrainerSignOffQueue`
- Always: `MyTrainingSection` for `assignments.filter(a => a.traineeId === user.id)`

- [ ] **Step 4: Wire Assign missing steps** — same body as former `onboardEmployee`, but trainee = selected person; success message like `Assigned N step(s) to {name}.` / `… already covered …`; errors without the word onboarding.

- [ ] **Step 5: Manual sanity** — `npx vitest run src/lib/training src/app/training` (page tests may still fail until Task 5)

- [ ] **Step 6: Commit**

```bash
git add src/app/training/page.tsx
git commit -m "feat(training): role-split Training page around People and attention"
```

---

### Task 5: Update page tests for new IA

**Files:**
- Modify: `src/app/training/__tests__/trainingPageActions.test.tsx`
- Optionally create: `src/app/training/__tests__/trainingPageRoles.test.tsx` for employee/trainer assertions

**Interfaces:**
- Consumes: rewritten page
- Produces: regression coverage for curriculum add + manager chrome absence + employee certify visibility

- [ ] **Step 1: Update mocks** — remove `TrainingLearnChart` mock if unused; keep `CurriculumSortList` mock.

- [ ] **Step 2: Keep curriculum Add tests** — they must still find title field + Add under Curriculum.

- [ ] **Step 3: Add manager chrome test**

```ts
it('does not show manager-irrelevant sections', () => {
  render(<TrainingPage />);
  expect(screen.queryByRole('heading', { name: /^my training$/i })).toBeNull();
  expect(screen.queryByRole('heading', { name: /^onboarding$/i })).toBeNull();
  expect(screen.queryByRole('heading', { name: /^all assignments$/i })).toBeNull();
  expect(screen.queryByRole('heading', { name: /^learn chart$/i })).toBeNull();
  expect(screen.getByRole('heading', { name: /^people$/i })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /needs attention/i })).toBeTruthy();
});
```

- [ ] **Step 4: Add employee certify test** — mock `useAuth` as employee `emp-2` with an `awaiting_trainee` assignment; assert **I was trained — certify** visible and manager headings absent.

Example auth mock override via `vi.doMock` / separate file with `useAuth` returning `{ user: { id: 'emp-2', name: 'Sam', role: 'employee' }, role: 'employee' }`.

- [ ] **Step 5: Run**

Run: `npx vitest run src/app/training src/lib/training`

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/training/__tests__
git commit -m "test(training): cover role-split Training page chrome and certify"
```

---

### Task 6: Copy sweep + final verification

**Files:**
- Modify: any remaining user-visible “onboard/onboarding” strings in `src/app/training/` and related empty states
- Do not rename event type `onboarded` in domain/types (internal)

- [ ] **Step 1: Grep**

Run: `rg -i "onboard" src/app/training src/components/training`

Expected: no user-facing Onboarding labels (code comments OK)

- [ ] **Step 2: Run full training + persistence suite**

Run: `npx vitest run src/lib/training src/app/training`

Expected: PASS

- [ ] **Step 3: Commit if any copy fixes**

```bash
git add -A src/app/training src/components/training
git commit -m "chore(training): remove remaining onboarding copy from Training UI"
```

(Skip commit if working tree clean.)

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Employee My training + certify | 3, 4, 5 |
| Trainer sign-off queue | 1, 3, 4 |
| Manager People → person detail | 3, 4 |
| Assign missing steps (no Onboarding) | 4, 6 |
| Needs attention three buckets | 1, 3, 4 |
| Miss strikes kept | 4 |
| Curriculum kept | 4 |
| Remove My training / Learn chart / All assignments / Trainers / stats / how-to on manager | 4, 5 |
| Dual sign-off unchanged | 1–6 (no domain changes) |
| Firestore hydrate survives preview | 2 |

## Self-review notes

- No TBD/placeholder steps.
- `buildTrainingAttentionRows` sort puts `needs_retrain` first so Approve is visible.
- `needs_retrain` is **not** also listed under awaiting_trainer (Approve first; after approve, row becomes `assigned` and appears there).
- Pairing lives only on `PersonTrainingPanel`, matching “drop standalone Trainers.”
