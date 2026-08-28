# UX Design System & Role-Based Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Sunny Fleet on the `globals.css` design system, add employee scan-first home, and polish manager/field flows (modals, par labels, inspect progress) for both roles in one release.

**Architecture:** Add small shared UI components (`PageHeader`, `ConfirmModal`, `QuantityModal`, `EmptyState`, `InspectionCalendar`) that wrap existing CSS primitives. Migrate pages phase-by-phase from legacy `slate-*`/`sky-*` Tailwind to token classes. Shell fixes (dynamic header title, main width) apply globally. No `db.ts` split; extend `AppSettings` only for `theme`.

**Tech Stack:** Next.js 14 App Router (static export), TypeScript, Tailwind + `globals.css` components, Vitest + jsdom, existing `dbService`

**Spec:** `docs/superpowers/specs/2026-08-28-ux-design-system-design.md`

## Global Constraints

- No new `sky-*`, `slate-*`, or `rounded-3xl` on migrated pages; use `globals.css` primitives (`.page`, `.card`, `.btn`, tokens).
- Amber (`data-status="flagged"`, `btn-attention`) reserved for "needs a human" only; primary actions use `btn-primary` (ink).
- Touch targets on field flows ≥ 44px (`--tap`).
- Do not split `db.ts` into modules in this plan.
- `npm test` and `npm run build` must pass after each task.
- GitHub Pages uses `NEXT_PUBLIC_BASE_PATH=/sunny`; keep `basePath.ts` in sync with `next.config.mjs`.
- No Playwright; manual smoke on 375px (employee) and 1280px (manager) before merge.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/pageTitles.ts` | Pathname → page title (+ detail overrides) |
| `src/components/PageHeader.tsx` | Reusable `.page-head` block |
| `src/components/ConfirmModal.tsx` | Accessible confirm/cancel overlay |
| `src/components/QuantityModal.tsx` | Numeric input modal for stock actions |
| `src/components/EmptyState.tsx` | `.empty` wrapper with icon + CTA |
| `src/components/InspectionCalendar.tsx` | Shared month grid + day status dots |
| `src/app/home/page.tsx` | Employee scan-first landing |
| `src/app/layout.tsx` | Main width, mobile drawer tokens, FAB restyle |
| `src/components/Header.tsx` | Dynamic title from `pageTitles` |
| `src/components/Sidebar.tsx` | Role-based `NAV_ITEMS` |
| `src/app/page.tsx` | Role-based redirect |
| `src/types/index.ts` | `AppSettings.theme` |
| `src/lib/db.ts` | Persist/apply theme in `getAppSettings`/`saveAppSettings` |
| Migrated `src/app/**/page.tsx` + `*Client.tsx` | Per-phase token migration |

---

### Task 1: Shared UI primitives + quantity validation

**Files:**
- Create: `src/lib/pageTitles.ts`
- Create: `src/components/PageHeader.tsx`
- Create: `src/components/ConfirmModal.tsx`
- Create: `src/components/QuantityModal.tsx`
- Create: `src/components/EmptyState.tsx`
- Create: `src/lib/quantityModal.ts`
- Create: `src/lib/__tests__/quantityModal.test.ts`

**Interfaces:**
- Produces:
  - `getPageTitle(pathname: string): string`
  - `PAGE_TITLES: Record<string, string>`
  - `PageHeader({ title, subtitle?, actions? }: { title: string; subtitle?: string; actions?: React.ReactNode })`
  - `ConfirmModal({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant?: 'danger' | 'default' })`
  - `QuantityModal({ open, title, description, initialValue, min?, max?, allowEmpty?, onConfirm: (qty: number) => void, onCancel: () => void })`
  - `EmptyState({ icon, title, children, action? })`
  - `parseQuantityInput(raw: string, opts?: { allowEmpty?: boolean }): { ok: true; value: number } | { ok: false; error: string }`

- [ ] **Step 1: Write failing quantity parse test**

Create `src/lib/__tests__/quantityModal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseQuantityInput } from '@/lib/quantityModal';

describe('parseQuantityInput', () => {
  it('rejects blank string', () => {
    expect(parseQuantityInput('')).toEqual({ ok: false, error: expect.any(String) });
    expect(parseQuantityInput('   ')).toEqual({ ok: false, error: expect.any(String) });
  });

  it('accepts valid whole numbers', () => {
    expect(parseQuantityInput('5')).toEqual({ ok: true, value: 5 });
    expect(parseQuantityInput('0')).toEqual({ ok: true, value: 0 });
  });

  it('rejects non-integers', () => {
    expect(parseQuantityInput('1.5').ok).toBe(false);
    expect(parseQuantityInput('abc').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/lib/__tests__/quantityModal.test.ts`  
Expected: FAIL — cannot find module `@/lib/quantityModal`

- [ ] **Step 3: Implement helpers + components**

`src/lib/quantityModal.ts`:

```ts
export function parseQuantityInput(
  raw: string,
  opts?: { min?: number; max?: number },
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Enter a quantity.' };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, error: 'Quantity must be a whole number ≥ 0.' };
  }
  if (opts?.min !== undefined && value < opts.min) {
    return { ok: false, error: `Minimum is ${opts.min}.` };
  }
  if (opts?.max !== undefined && value > opts.max) {
    return { ok: false, error: `Maximum is ${opts.max}.` };
  }
  return { ok: true, value };
}
```

`src/lib/pageTitles.ts`:

```ts
import { NAV_ITEMS } from '@/components/Sidebar';

export const PAGE_TITLES: Record<string, string> = {
  '/home': 'Home',
  '/vehicles/detail': 'Vehicle',
};

export function getPageTitle(pathname: string): string {
  const base = pathname.split('?')[0];
  if (PAGE_TITLES[base]) return PAGE_TITLES[base];
  const match = NAV_ITEMS.find(
    item => base === item.href || (item.href !== '/dashboard' && base.startsWith(item.href)),
  );
  return match?.label || 'Sunny Fleet';
}
```

Export `NAV_ITEMS` from `Sidebar.tsx` (change `const NAV_ITEMS` to `export const NAV_ITEMS`).

`PageHeader.tsx` — render `.page-head` with `.page-title` / `.page-sub` and optional `actions` slot.

`ConfirmModal.tsx` — fixed overlay, `role="dialog"`, `aria-modal`, focus trap optional but minimum: backdrop click + Cancel calls `onCancel`, Confirm calls `onConfirm`. Use `.btn-primary` / `.btn-secondary` / `.btn-danger`.

`QuantityModal.tsx` — uses `parseQuantityInput` on submit; shows inline error; `type="number"` input with `min={0}`; Cancel does not submit.

`EmptyState.tsx` — `.empty` + `.empty-title` + optional button child.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/__tests__/quantityModal.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pageTitles.ts src/lib/quantityModal.ts src/lib/__tests__/quantityModal.test.ts \
  src/components/PageHeader.tsx src/components/ConfirmModal.tsx src/components/QuantityModal.tsx \
  src/components/EmptyState.tsx src/components/Sidebar.tsx
git commit -m "feat: add shared page header and modal primitives"
```

---

### Task 2: Shell fixes (layout, header, mobile drawer, FAB)

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `getPageTitle` from `@/lib/pageTitles`

- [ ] **Step 1: Dynamic header title**

In `Header.tsx`, import `usePathname` from `next/navigation` and `getPageTitle`:

```tsx
import { usePathname } from 'next/navigation';
import { getPageTitle } from '@/lib/pageTitles';

// inside component:
const pathname = usePathname();
const pageTitle = getPageTitle(pathname || '/dashboard');

// replace hardcoded "Dashboard":
<h1 className="page-title text-xl truncate">{pageTitle}</h1>
```

Show title on mobile too (remove `hidden lg:block` from title wrapper or show abbreviated title next to logo).

- [ ] **Step 2: Standardize main container**

In `layout.tsx`, replace `<main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">` with:

```tsx
<main className="flex-1 w-full max-w-[1400px] mx-auto px-[var(--gutter)] py-4 sm:py-8 pb-24 lg:pb-8">
```

- [ ] **Step 3: Mobile drawer tokens**

Replace mobile drawer classes:

```tsx
// backdrop
className="fixed inset-0 bg-ink/60 backdrop-blur-sm"
// panel
className="relative bg-surface w-72 h-full shadow-lg flex flex-col ..."
// close button
className="p-1 rounded-full text-ink-muted hover:bg-surface-sunk"
```

- [ ] **Step 4: FAB scan button**

Replace floating button classes with:

```tsx
className="btn btn-primary flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg lg:hidden fixed bottom-6 right-6 z-40"
```

- [ ] **Step 5: Manual smoke**

Run: `npm run dev` — navigate to `/vehicles`, `/issues`; confirm header title updates.

- [ ] **Step 6: Commit**

```bash
git add src/components/Header.tsx src/app/layout.tsx
git commit -m "fix: dynamic header title and shell layout tokens"
```

---

### Task 3: InspectionCalendar + employee home + role redirect

**Files:**
- Create: `src/components/InspectionCalendar.tsx`
- Create: `src/app/home/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/dashboard/page.tsx` (use shared calendar)

**Interfaces:**
- Produces:
  - `InspectionCalendar({ inspections, issues, monthDate, onMonthChange, onDayClick?, compact?: boolean })`
  - `getHomePath(role: 'employee' | 'manager'): '/home' | '/dashboard'`

- [ ] **Step 1: Extract calendar from dashboard**

Create `src/components/InspectionCalendar.tsx` by moving `getDayStatus`, month nav, and day grid from `dashboard/page.tsx`. Props:

```tsx
type InspectionCalendarProps = {
  inspections: Inspection[];
  issues: Issue[];
  monthDate: Date;
  onMonthChange: (d: Date) => void;
  onDayClick?: (dateString: string) => void;
  compact?: boolean;
};
```

Replace inline calendar in `dashboard/page.tsx` with `<InspectionCalendar compact onDayClick={(d) => router.push(\`/calendar?date=${d}\`)} ... />`.

- [ ] **Step 2: Role redirect helper**

`src/lib/pageTitles.ts` (or new `src/lib/roleHome.ts`):

```ts
export function getHomePath(role: 'employee' | 'manager'): '/home' | '/dashboard' {
  return role === 'manager' ? '/dashboard' : '/home';
}
```

Update `src/app/page.tsx` to a client wrapper or use middleware-free pattern:

Create `src/app/HomeRedirect.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getHomePath } from '@/lib/roleHome';

export function HomeRedirect() {
  const { role, hydrated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!hydrated) return;
    router.replace(getHomePath(role));
  }, [hydrated, role, router]);
  return null;
}
```

`page.tsx`: render `<HomeRedirect />`.

- [ ] **Step 3: Employee home page**

Create `src/app/home/page.tsx`:

```tsx
'use client';
// useAuth, dbService, Link, QrCode icon
// .page wrapper
// Hero card: btn btn-primary btn-block → /scan
// Section: "My recent inspections" — last 5 where inspection.userId === user.id
// EmptyState if none with CTA to scan
// Optional: open FleetTask for user
```

- [ ] **Step 4: Sidebar nav split**

Update `NAV_ITEMS`:

```ts
{ label: 'Home', href: '/home', icon: Home, employeeOnly: true },
{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, managerOnly: true },
// Inspections: employeeOnly: false, managerOnly: false (both)
```

Filter:

```ts
NAV_ITEMS.filter(item => {
  if (item.managerOnly && role !== 'manager') return false;
  if (item.employeeOnly && role === 'manager') return false;
  return true;
})
```

- [ ] **Step 5: Build check**

Run: `npm run build`  
Expected: success

- [ ] **Step 6: Commit**

```bash
git add src/components/InspectionCalendar.tsx src/app/home/page.tsx src/app/page.tsx \
  src/lib/roleHome.ts src/components/Sidebar.tsx src/app/dashboard/page.tsx
git commit -m "feat: employee home, role redirect, shared inspection calendar"
```

---

### Task 4: Issues page — design system + QuantityModal

**Files:**
- Modify: `src/app/issues/page.tsx`

**Interfaces:**
- Consumes: `QuantityModal`, `ConfirmModal`, `PageHeader`, `parseQuantityInput`

- [ ] **Step 1: Replace prompts in handleStockAction**

Add state:

```tsx
const [quantityModal, setQuantityModal] = useState<{
  action: 'update_stock' | 'remove_from_van';
  issue: Issue;
} | null>(null);
```

`update_stock` button → `setQuantityModal({ action: 'update_stock', issue })`.

`remove_from_van` → `ConfirmModal` first, then optional `QuantityModal` with description "Leave blank to remove all" — if blank on confirm for remove, pass `undefined` quantity to `resolveStockIssue`.

Remove all `window.prompt` / `window.confirm` from this file.

- [ ] **Step 2: Token migration**

Replace outer wrapper with `className="page"`. Replace `slate-*`/`sky-*` filters and cards with `.card`, `.card-pad`, `.btn`, `.btn-secondary`. Stock row shows:

```tsx
Held {held} / Required {issue.requiredQuantity}
```

with `data-status="flagged"` when `held < required`.

- [ ] **Step 3: PageHeader**

Replace duplicate header block with:

```tsx
<PageHeader
  title="Active Equipment Issues"
  subtitle="Trace problems, update stock, and audit resolution history."
/>
```

- [ ] **Step 4: Verify**

Run: `npm test` && `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/app/issues/page.tsx
git commit -m "refactor: migrate issues page to design system and quantity modal"
```

---

### Task 5: Vehicles, equipment, vehicle detail

**Files:**
- Modify: `src/app/vehicles/page.tsx`
- Modify: `src/app/equipment/page.tsx`
- Modify: `src/app/vehicles/detail/VehicleDetailClient.tsx`

**Interfaces:**
- Consumes: `QuantityModal`, `ConfirmModal`, `PageHeader`, `EmptyState`

- [ ] **Step 1: Vehicles list migration**

- Wrap in `.page`; use `PageHeader` for title/subtitle.
- Delete modal: `ConfirmModal` with two radio options (return stock / delete associated) — keep existing `deleteEquipmentMode` logic.
- Replace `sky-*`/`slate-*`/`rounded-3xl` with `.card`, `.btn`, tokens.

- [ ] **Step 2: Equipment page migration**

Same token pass; catalog columns use `.card` lists; modals use `.btn-primary` / `.btn-danger`.

- [ ] **Step 3: Vehicle detail — par + return modal**

For each assigned equipment row:
- Show `Held {qty} / Required {requiredQuantity ?? '—'}`.
- Inline `<input type="number">` for par saves via `dbService.setAssignmentRequiredQuantity` on blur or small Save button.
- **Return to shop** opens `QuantityModal` (max = held qty) → `returnEquipmentToShop`.
- Remove `prompt()` calls.

- [ ] **Step 4: Build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/app/vehicles/page.tsx src/app/equipment/page.tsx src/app/vehicles/detail/VehicleDetailClient.tsx
git commit -m "refactor: migrate vehicles and equipment to design system"
```

---

### Task 6: Inspect flow polish (field / mobile)

**Files:**
- Modify: `src/app/inspect/InspectClient.tsx`

**Interfaces:**
- Consumes: `canSubmitInspection` from `inspectionValidation.ts`, `RecentInspectors`

- [ ] **Step 1: Progress bar**

```tsx
const requiredQuestions = questions.filter(q => q.required);
const answeredCount = requiredQuestions.filter(q => {
  const v = responses[q.id]?.value;
  return v !== undefined && v !== null && v !== '';
}).length;

// Sticky bar above form:
<div className="sticky top-0 z-10 bg-surface border-b border-line py-2">
  <p className="text-sm text-ink-muted">Answered {answeredCount} / {requiredQuestions.length}</p>
  <div className="h-1.5 bg-surface-sunk rounded-full mt-1">
    <div
      className="h-full bg-ink rounded-full transition-all"
      style={{ width: `${requiredQuestions.length ? (answeredCount / requiredQuestions.length) * 100 : 0}%` }}
    />
  </div>
</div>
```

- [ ] **Step 2: Category chip nav**

Sticky below progress (or combined): horizontal scroll of buttons per category; `onClick` → `document.getElementById(\`cat-${cat.id}\`)?.scrollIntoView({ behavior: 'smooth' })`.

Add `id={\`cat-${cat.id}\`}` on each `<section>`.

- [ ] **Step 3: Fix "All Clear" badge**

Only show when `answeredCount === requiredQuestions.length && flaggedCount === 0` (not when unanswered).

- [ ] **Step 4: Success screen**

After submit, render `<RecentInspectors vehicleId={vehicle.id} />` and `btn btn-primary` → `/scan`.

- [ ] **Step 5: Token migration pass**

Replace remaining `sky-*`/`slate-*` in InspectClient with `.btn`, `.card`, token text colors.

- [ ] **Step 6: Tests**

Run: `npm test -- src/app/inspect/inspectionValidation.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/app/inspect/InspectClient.tsx
git commit -m "feat: inspect progress, category nav, and design tokens"
```

---

### Task 7: Long-tail page migration

**Files:**
- Modify: `src/app/inspections/page.tsx`
- Modify: `src/app/employees/page.tsx`
- Modify: `src/app/calendar/page.tsx`
- Modify: `src/app/reports/page.tsx`
- Modify: `src/app/scan/page.tsx`
- Modify: `src/app/equipment/scan/EquipmentScanClient.tsx`
- Modify: `src/components/IssueTimeline.tsx`
- Modify: `src/components/QRScannerModal.tsx`
- Modify: `src/components/PasscodeGate.tsx`
- Modify: `src/components/StatusBadges.tsx` (align with tokens if not already)

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`, design tokens

- [ ] **Step 1: Per-file token pass**

For each file above:
1. Root wrapper → `className="page"` where appropriate.
2. Replace `bg-white` → `bg-surface`, `text-slate-500` → `text-ink-muted`, `bg-sky-600` buttons → `btn btn-primary`.
3. Replace page-specific header duplicates with `PageHeader`.
4. Empty lists → `<EmptyState>`.

`/calendar/page.tsx`: use `<InspectionCalendar compact={false} />` instead of duplicating grid logic.

- [ ] **Step 2: Grep gate**

Run: `rg 'sky-|slate-' src/app/inspections src/app/employees src/app/calendar src/app/reports src/app/scan src/app/equipment/scan`  
Expected: no matches (or only unavoidable third-party strings).

- [ ] **Step 3: Build + test**

Run: `npm test` && `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/inspections src/app/employees src/app/calendar src/app/reports src/app/scan \
  src/app/equipment/scan src/components/IssueTimeline.tsx src/components/QRScannerModal.tsx \
  src/components/PasscodeGate.tsx src/components/StatusBadges.tsx
git commit -m "refactor: migrate remaining routes to design system"
```

---

### Task 8: Settings tabs + dark mode + dashboard polish

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/__tests__/appSettings.test.ts`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/layout.tsx` (apply theme on load)

**Interfaces:**
- Produces: `AppSettings { recentInspectorsDepth: 1 | 3; theme?: 'light' | 'dark' }`
- `applyAppTheme(theme: 'light' | 'dark'): void` in db or small `src/lib/theme.ts`

- [ ] **Step 1: Extend AppSettings**

```ts
export interface AppSettings {
  recentInspectorsDepth: 1 | 3;
  theme?: 'light' | 'dark';
}
```

In `db.ts` `getAppSettings` / `saveAppSettings`, default `theme` to `'light'`.

- [ ] **Step 2: Apply theme on load**

In `layout.tsx` or a tiny `ThemeInit` client component:

```tsx
useEffect(() => {
  const { theme } = dbService.getAppSettings();
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
}, []);
```

Settings Appearance tab: radio Light/Dark → `saveAppSettings({ ...current, theme })` + immediate `dataset.theme` update.

- [ ] **Step 3: Settings tabbed layout**

Split `settings/page.tsx` into tab state: `'checklist' | 'equipment' | 'tasks' | 'appearance' | 'danger'`.

Use `.cluster` + `.btn-secondary` / active tab style for tab buttons; only one section mounted visible at a time.

- [ ] **Step 4: Dashboard enhancements**

- Vehicles in use table: add `currentUserStartTime` column (formatted time).
- Recent inspections: link rows to `/inspections` or expand.
- Open issues widget: top 5 with issue type label.
- Empty widgets: `EmptyState` with "Reset demo data" hint linking to Settings danger zone.

- [ ] **Step 5: Update appSettings test**

Add test that `theme` defaults to light and persists.

- [ ] **Step 6: Full verification**

```bash
npm test
npm run build
rg 'sky-|slate-' src/app src/components --glob '!**/node_modules/**' | head
```

Expected: zero or only legacy files explicitly deferred (document in commit if any remain).

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/db.ts src/lib/__tests__/appSettings.test.ts \
  src/app/settings/page.tsx src/app/dashboard/page.tsx src/app/layout.tsx
git commit -m "feat: settings tabs, dark mode toggle, dashboard polish"
```

---

### Task 9: Docs + PROJECT_INDEX update

**Files:**
- Modify: `PROJECT_INDEX.md`
- Modify: `PROJECT-FILE-GUIDE.md` (if present)

- [ ] **Step 1: Document new components and `/home` route**

Add bullets for `PageHeader`, modals, `InspectionCalendar`, `src/app/home/page.tsx`, `AppSettings.theme`.

- [ ] **Step 2: Commit**

```bash
git add PROJECT_INDEX.md PROJECT-FILE-GUIDE.md
git commit -m "docs: note UX design system components and employee home"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Design system on all pages | Tasks 4–7, 8 |
| Employee scan-first home | Task 3 |
| Manager dashboard parity | Task 8 |
| Header title fix | Task 2 |
| QuantityModal not prompt | Tasks 1, 4, 5 |
| Held/Required labels | Tasks 4, 5 |
| Inspect progress + category nav | Task 6 |
| Dark mode toggle | Task 8 |
| InspectionCalendar shared | Tasks 3, 7 |
| Settings tabs | Task 8 |
| npm test + build each phase | Every task |
| No db.ts split | Global constraints |

No placeholders remain; `parseQuantityInput`, modal props, and `getHomePath` are consistent across tasks.
