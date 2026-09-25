# Resizable Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide reliable always-available dashboard dragging and width/height resizing in Customize mode, with individual metrics and personal responsive layouts.

**Architecture:** A pure layout module owns validation, migration, defaults, and per-manager persistence. A focused React Grid Layout component owns pointer, touch, resize, and keyboard controls. The existing dashboard page continues to supply fleet data, widget content, and actions.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, react-grid-layout 2.2.4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-resizable-dashboard-design.md`

## Global Constraints

- Deliver to preview and Vercel preview. Production main and its QR routes are not part of this change.
- Managers can drag by a visible handle at any time; Customize reveals width and height resize handles.
- Three desktop columns, two tablet columns, one phone column; preserve each breakpoint's layout independently.
- Keep real fleet data, working controls, personal colors, pinned safety notices, and pending deletion approvals.
- Preserve the original saved layout key for migration and rollback.
- Apply the user-supplied five-ramp palette to personal colorful mode, using the exact role mapping in the spec.
- Browser interaction checks must be reported independently of unit tests and builds.

## Review Focus

- Empty or malformed stored data must render a usable dashboard instead of a blank grid (Task 1).
- A manager switch or mobile resize must not overwrite another manager or breakpoint (Tasks 1 and 2).
- A conditional lifespan widget returning must not overlap or remove other cards (Tasks 1 and 2).
- A drag or resize followed by a live data update must retain the layout and working controls (Task 2 browser checks).
- Small card sizes must keep actions accessible through minimum sizes and content scrolling (Tasks 2 and 3).

## File Map

- Create `src/lib/dashboardGridLayout.ts`: IDs, widget metadata, versioned layout types, validation, migration, storage helpers.
- Create `src/lib/__tests__/dashboardGridLayout.test.ts`: persistence, migration, bounds, collision, and visibility tests.
- Create `src/components/DashboardGrid.tsx`: measured responsive grid, handles, interaction state, keyboard controls, errors.
- Modify `src/app/dashboard/page.tsx`: individual metric widget registration and new grid state.
- Modify `src/app/globals.css`: grid library styles, resize/drag affordances, content scrolling and palette surfaces.
- Modify `tailwind.config.ts`: add all user-supplied palette shades without replacing existing semantic status tokens.
- Modify `package.json` and `package-lock.json`: install react-grid-layout 2.2.4; remove Swapy after confirming no remaining consumers.
- Remove `src/components/DashboardSwapGrid.tsx` after integration. Keep the old layout module for migration and its existing tests.

## Task 1: Versioned grid data and migration

**Interfaces**

```ts
type GridBreakpoint = 'desktop' | 'tablet' | 'phone';
type GridWidgetId = 'total_vehicles' | 'inspections_today' | 'open_issue_count'
  | 'vehicles_in_use_count' | 'equipment_due_count' | 'today_issues'
  | 'open_issues' | 'in_use' | 'activity' | 'calendar' | 'lifespan' | 'safety';
type GridWidgetPosition = { i: GridWidgetId; x: number; y: number; w: number; h: number };
type DashboardGridState = { version: 2; layouts: Record<GridBreakpoint, GridWidgetPosition[]> };
// Export from dashboardGridLayout.ts:
// GRID_COLUMNS: {desktop:3, tablet:2, phone:1}
// GRID_WIDGET_META: Record<GridWidgetId, {label:string; minH:number; defaultH:number}>
// defaultDashboardGrid(): DashboardGridState
// normalizeGridLayout(value: unknown, breakpoint: GridBreakpoint): GridWidgetPosition[]
// migrateDashboardLayout(legacy: unknown): DashboardGridState
// loadDashboardGrid(userId: string): DashboardGridState
// saveDashboardGrid(userId: string, state: DashboardGridState): boolean
// resetDashboardGrid(userId: string): DashboardGridState
```

- [ ] Write failing tests using legacy defaults: expand `stats` into five unique metric IDs, preserve all other IDs and order, map legacy wide to three desktop columns, and leave the old storage key unchanged. Assert every card fits its breakpoint, cards have finite integer positions, and no rectangles overlap.
- [ ] Add tests for a duplicate/unknown ID, NaN coordinates, missing layouts, malformed JSON, unavailable localStorage, isolation between managers, preservation of other breakpoints, and a temporarily hidden lifespan widget retaining its saved position.
- [ ] Run `npx vitest run src/lib/__tests__/dashboardGridLayout.test.ts` and confirm the missing behavior fails.
- [ ] Implement defaults with metric height 3 rows/minimum 2, list sections height 6/minimum 3, calendar height 7/minimum 5, and vehicles in use height 8/minimum 4. Normalize integer coordinates; clamp widths to the breakpoint and heights to 2–30 rows with widget minimums. Place missing or colliding cards at the next free row using rectangle intersection, retaining valid non-overlapping positions. Keep hidden entries in saved state.
- [ ] Use `sunny_dashboard_grid_v2_<userId>` as the new key. Read legacy `sunny_dashboard_layout_<userId>` only if no valid version-2 state exists. Catch read errors and return defaults; catch write errors and return false. Reset the new key to defaults so it does not remigrate the old order on reload.
- [ ] Run the focused tests and commit the data module and tests.

## Task 2: Drag and resize component

**Interface**

```ts
type DashboardGridProps = {
  userId: string;
  widgets: { id: GridWidgetId; content: React.ReactNode }[];
  state: DashboardGridState;
  colorful: boolean;
  customize: boolean;
  onChange: (next: DashboardGridState) => void;
};
```

- [ ] Install `react-grid-layout@2.2.4` with a lockfile. Inspect its shipped types and official v2 documentation before connecting callbacks: https://github.com/react-grid-layout/react-grid-layout. Use React-controlled layout state and `useContainerWidth` to wait for a measured container before rendering the interactive grid.
- [ ] Configure desktop at available width 1000px or more, tablet at 640–999px, phone below 640px; choose `GRID_COLUMNS[breakpoint]`. Use 56px row height and 16px gaps. Supply each visible widget's saved rectangle and widget minimum height; allow one through the available number of columns.
- [ ] Always enable dragging from `.dashboard-drag-handle`, with a minimum 44px touch target. Cancel dragging on links, buttons outside the handle, inputs, selects, textareas, and card content. Enable right, bottom, and bottom-right resize handles only in Customize mode. Use the library's collision handling and a visible destination outline.
- [ ] Update the active in-memory layout during movement as required by the library; persist via `onChange` only when a drag or resize finishes. Merge visible positions with saved hidden widgets; reconcile a returning widget without deleting others. Do not remount the grid on every order change or content refresh. Key its account lifecycle by userId so changing accounts cannot write the old manager's state into the new account.
- [ ] Add keyboard alternatives in Customize mode: move controls and numeric width/height controls bounded by the same grid rules. Keep a fixed card header and an independently scrollable content body. Preserve semantic colors and focus indicators.
- [ ] Verify component updates preserve all cards through a mocked live-data rerender and hide/show of lifespan content. Test movement/resizing of visible rectangles leaves other breakpoint arrays unchanged. Run the focused layout tests and Next build, then commit the component.

## Task 3: Dashboard integration and preview verification

- [ ] Replace the page's Swapy layout state with `DashboardGridState`, loaded for the current manager. Save complete layout state through the new helper; show an inline save error when it returns false, and keep the in-memory arrangement. Retain the existing colorful preference load and Settings switch.
- [ ] Extract the five metric JSX bodies from the grouped `stats` section into the five new IDs. Preserve their counts, links, status indicators, and empty states. Keep other sections and callbacks intact. Register widgets as data passed to `DashboardGrid`; keep safety banners, deletion approvals, and modal overlays outside the grid.
- [ ] Remove the forced 60rem metric strip and legacy size dropdown. Let each metric occupy its own rectangle. Retain table horizontal scrolling for data that cannot fit its card; apply vertical content scrolling according to the chosen card height. Keep Reset layout and Customize controls above the grid.
- [ ] Add the five exact palette ramps to Tailwind. Apply the spec's ivory backdrop, pastel card surfaces, dark blue typography, and blue focus accents only inside personal colorful mode. Verify text contrast, visible focus, and that disabling the setting restores the standard dashboard. Keep status badge colors semantic.
- [ ] Search for Swapy imports. Remove `DashboardSwapGrid.tsx` and uninstall `swapy` only when the new component is the sole dashboard implementation. Keep the legacy persistence module for migration.
- [ ] Run `npx tsc --noEmit`, `npm test`, and `npm run build`; fix regressions. Inspect the diff for accidental changes to QR routes, data mutation, and role checks.
- [ ] In a browser, drag several different cards repeatedly, resize to one/two/three columns and different heights, navigate away and reload, switch accounts, switch breakpoints, and activate links and action buttons. Check touch dragging and resizing and verify the body can still scroll. If this environment cannot launch a browser, report that limit and do not claim interaction quality is verified.
- [ ] Publish the tested diff as one commit to preview. Confirm Vercel readiness and both hosting/QR Actions jobs, and provide the preview URL for production review.

## Self-review

- Spec coverage: migration, drag, width/height resize, manager isolation, responsive persistence, hidden widgets, personal palette, save failures, and preview-only delivery are assigned above.
- Interface consistency: all grid IDs and breakpoint names agree between data module, component props, and page integration.
- Reset saves version-2 defaults rather than deleting the key, preventing legacy migration from undoing reset.
- Review focus maps to persistence tests and browser interaction checks. Browser availability remains an explicit verification limit.
