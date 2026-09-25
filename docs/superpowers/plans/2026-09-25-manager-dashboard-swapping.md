# Manager Dashboard Swapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing Sunny fleet widgets draggable by their handles at any time, with a personal manager color switch.

**Architecture:** Keep the dashboard's existing data and actions. Move its widget JSX into a single React controlled Swapy grid, keeping safety notices outside. Persist slot order through the existing per-user localStorage layout API, and store the color boolean under another user-specific localStorage key.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, Swapy, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-manager-dashboard-swapping-design.md`

## Global Constraints

- Work on `preview`; leave main, production QR URLs, Firebase rules, and employee screens alone.
- Use real fleet data and preserve working card actions, size controls, keyboard reorder, and reset.
- The color option defaults to off and belongs to one manager account in this browser.
- An urgent safety banner and pending deletion approvals remain above the movable grid.

## Review Focus

- Switching managers in the same browser loads each account's own color and widget order; test in Task 1.
- A malformed stored preference falls back to the standard palette; test in Task 1.
- An absent conditional widget does not corrupt the saved order; test in Task 2.
- A handle drag does not activate a card link or destructive action; browser check in Task 3.
- A narrow viewport still permits table scrolling and moving cards by touch; browser check in Task 3.

---

### Task 1: Personal color preference

**Files:** Create `src/lib/dashboardAppearance.ts`; create `src/lib/__tests__/dashboardAppearance.test.ts`; modify `src/app/settings/page.tsx` Appearance section.

**Interfaces:** `loadDashboardColor(userId?: string | null): boolean`, `saveDashboardColor(userId: string, enabled: boolean): void`; storage key prefix `sunny_dashboard_color_`. Only authenticated true managers can edit this from Settings. Do not add to global `AppSettings`.

- [ ] **Step 1: Write failing tests** for default false, malformed data, and isolation across two IDs:

```ts
expect(loadDashboardColor('a')).toBe(false);
saveDashboardColor('a', true);
expect(loadDashboardColor('a')).toBe(true);
expect(loadDashboardColor('b')).toBe(false);
localStorage.setItem('sunny_dashboard_color_a', 'broken');
expect(loadDashboardColor('a')).toBe(false);
```

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/dashboardAppearance.test.ts`; expect failure until exports exist.
- [ ] **Step 3: Implement** functions using `localStorage` with `typeof window` guards, JSON boolean parsing, and a try/catch fallback. In Appearance add a checked switch bound to current user's ID; save immediately on change and show standard/colorful labels. Reload state on `currentUser?.id` changes.
- [ ] **Step 4: Run** that focused test and `npx tsc --noEmit`; expect pass.
- [ ] **Step 5: Commit** `src/lib/dashboardAppearance.ts`, its test, and Settings with message `Add personal manager dashboard color preference`.

### Task 2: React controlled swap grid

**Files:** Modify `package.json`, `package-lock.json`, `src/lib/dashboardLayout.ts`, `src/lib/__tests__/dashboardLayout.test.ts`, `src/app/dashboard/page.tsx`; create `src/components/DashboardSwapGrid.tsx`.

**Interfaces:** `DashboardSwapGrid` receives ordered `{id: DashboardWidgetId; size: DashboardWidgetSize; content: React.ReactNode}[]`, `colorful: boolean`, `onReorder(ids: DashboardWidgetId[]): void`, plus the existing size and keyboard move controls. `reorderVisibleDashboardWidgets(layout, visibleIds, newVisibleOrder)` returns a normalized layout while retaining the positions and sizes of hidden widgets. Use `swapy` APIs `createSwapy`, `utils.initSlotItemMap`, `utils.toSlottedItems`, `utils.dynamicSwapy` and `manualSwap: true`. Refer to https://swapy.tahazsh.com/docs/framework-react-dynamic/ for dynamic items. Keep stable slot IDs and `data-swapy-handle` on the visible grab area; use `onSwapEnd` to persist completed order.

- [ ] **Step 1: Write a failing `dashboardLayout` test** using defaults with `lifespan` hidden and two swapped visible IDs; assert `lifespan` stays in saved layout with its size, other IDs retain exactly one occurrence, and a second reload preserves visible order.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/dashboardLayout.test.ts`; expect failure from the absent helper.
- [ ] **Step 3: Implement** the pure merge helper; keep existing storage shape and normalization so old manager layouts still load. Run focused test to green.
- [ ] **Step 4: Install** `swapy` with `npm install swapy` and commit its lockfile. Build `DashboardSwapGrid` as a controlled component; create/destroy Swapy in an effect, synchronize dynamic widget arrays using `utils.dynamicSwapy`, and on swap end derive visible order from `slotItemMap.asArray`. If initialization fails, render cards and expose keyboard controls. Style slots responsively and use a visible handle with accessible name.
- [ ] **Step 5: Refactor** dashboard JSX to collect the existing eight widget contents in one keyed list rendered by the grid; remove old native `draggable`, `dragId`, and `dragOverId` handlers. Keep urgent and pending delete notices outside. The settings preference changes widget surface classes only, with existing status semantics and contrast retained. Keep `Customize layout` to reveal size and reset controls, while handles work all the time.
- [ ] **Step 6: Run** `npx vitest run src/lib/__tests__/dashboardLayout.test.ts src/lib/__tests__/dashboardAppearance.test.ts`, `npx tsc --noEmit`, and `npm run build`; expect pass. Commit with message `Enable persistent Swapy dashboard widget dragging`.

### Task 3: End-to-end checks and preview delivery

**Files:** Only correct files from Tasks 1–2 if verification exposes a defect.

- [ ] **Step 1: Run** `npm test`; record unrelated baseline failures separately instead of silently changing domain logic.
- [ ] **Step 2: Browser check** at desktop and phone widths: grab a handle, hover or touch another widget, release, reload, verify order; click a widget link and a destructive action without triggering a swap; test tables/calendar and urgent notices; test color on one manager account and standard on another.
- [ ] **Step 3: Confirm** git diff is restricted to dashboard, settings, tests, dependency, and design files. Verify both hosting URL checks or equivalent configuration checks still pass.
- [ ] **Step 4: Publish** only to `preview`; inspect the Vercel preview build and report the commit and any verification limits. Do not merge to `main`.
