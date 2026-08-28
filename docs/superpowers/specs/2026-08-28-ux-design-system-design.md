# Design: UX Consistency, Role-Based Layout & Field/Manager Polish

**Date:** 2026-08-28  
**Status:** Approved (pending written-spec review)  
**Scope:** Both field employees and managers — one coordinated release  
**Stack:** Next.js 14 static export, `globals.css` design tokens, existing `dbService`

---

## 1. Overview

Sunny Fleet has a strong new visual system in `globals.css` (charcoal + amber, `.page` / `.card` / `.btn` primitives) but only the **dashboard** and partial **header** use it. Most routes still use legacy `slate-*` / `sky-*` Tailwind, which causes inconsistent spacing, colors, and density between pages and between localhost vs GitHub Pages.

This spec unifies the UI on the design system and ships paired **employee** (mobile scan/inspect) and **manager** (dashboard, inventory, issues) improvements in one pass.

**Goals:**
1. Every page looks and spaces like the dashboard (token-driven, not ad-hoc Tailwind).
2. Employees get a scan-first home; managers keep the operational dashboard.
3. Replace brittle `prompt()` / `alert()` patterns with proper modals on inventory and issues flows.
4. Surface par/stock and recent-inspector context where decisions happen.
5. Fix shell bugs (header title, mobile drawer tokens, main width).

**Non-goals:**
- Rewriting `db.ts` into multiple files (separate refactor).
- Full dark-mode theme polish beyond a Settings toggle wiring `data-theme`.
- Native mobile app / PWA (optional follow-up).

---

## 2. Approaches considered

| Approach | Summary | Trade-offs |
|----------|---------|------------|
| **A — Migrate page-by-page + UX polish (recommended)** | Add shared UI primitives, migrate routes in priority order, then role-based home | Steady PRs, testable increments; takes multiple tasks |
| **B — Big-bang restyle all pages in one diff** | Replace all Tailwind in one commit | Fast visually, hard to review, high regression risk |
| **C — Revert to Tailwind-only, drop `globals.css` components** | Undo design system | Throws away invested tokens; does not match reference quality |

**Recommendation:** Approach A.

---

## 3. Design system (styling)

### 3.1 Single source of truth

All user-facing surfaces use classes from `globals.css` `@layer components`:

| Primitive | Use for |
|-----------|---------|
| `.page`, `.page-head`, `.page-title`, `.page-sub` | Page wrapper and title block |
| `.card`, `.card-pad`, `.card-head`, `.card-foot` | Panels and widgets |
| `.grid-auto` | Responsive KPI / widget grids (`--min` via inline style when needed) |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-attention`, `.btn-danger`, `.btn-sm` | Actions |
| `.stat`, `.stat-value`, `.stat-label` | KPI numbers |
| `.empty`, `.empty-title` | Zero-data states |
| `.stack`, `.cluster`, `.spread` | Layout rhythm |
| `.link-action` | Footer links on cards |
| `data-status` on `.card` / `.icon-tile` | Amber rail for flagged items only |

**Rule:** No new `sky-*`, `slate-*`, or `rounded-3xl` on migrated pages. Legacy colors map to tokens:

| Legacy | Token equivalent |
|--------|------------------|
| `bg-slate-50` | `bg` / page background (body) |
| `bg-white` | `surface` |
| `text-slate-500` | `ink-muted` |
| `bg-sky-600` | `btn-primary` (ink charcoal) |
| `text-amber-*` / warning | `data-status="flagged"` or `btn-attention` |

Extend `tailwind.config.ts` only where tokens need Tailwind aliases (`surface`, `ink`, `line`) — already partially done; align with `globals.css` names.

### 3.2 Shared components to add

| Component | Path | Purpose |
|-----------|------|---------|
| `PageHeader` | `src/components/PageHeader.tsx` | Title, subtitle, optional actions — replaces per-page duplicate headers |
| `ConfirmModal` | `src/components/ConfirmModal.tsx` | Accessible confirm/cancel overlay |
| `QuantityModal` | `src/components/QuantityModal.tsx` | Numeric stepper for stock actions (replaces `prompt`) |
| `EmptyState` | `src/components/EmptyState.tsx` | Wraps `.empty` with icon + CTA slot |

### 3.3 Shell fixes

| Issue | Fix |
|-------|-----|
| Header always says "Dashboard" | `Header` reads `pathname` → title from `NAV_ITEMS` or `PAGE_TITLES` map; optional `usePageTitle()` context for detail pages |
| Mobile drawer uses `slate-*` / `bg-white` | Use `surface`, `line`, `ink-muted` tokens to match `Sidebar` |
| `<main>` `max-w-7xl` vs dashboard `max-w-full` | Standardize: `main` uses `w-full max-w-[1400px] mx-auto px-[var(--gutter)]` and drop conflicting per-page max-width |
| FAB scan button | Restyle with `.btn-primary` + token shadow; keep `lg:hidden` |

### 3.4 Dark mode (minimal)

- Settings → Appearance: radio **Light** / **Dark**.
- `saveAppSettings` extended with `theme: 'light' | 'dark'` (or separate key).
- On change: `document.documentElement.dataset.theme = theme`.
- Tokens already defined under `[data-theme='dark']` in `globals.css`.

---

## 4. Layout & information architecture

### 4.1 Role-based home (`src/app/page.tsx`)

| Role | Redirect / home |
|------|-----------------|
| **Employee** | `/home` — new employee landing (or `/scan` with summary strip) |
| **Manager** | `/dashboard` (unchanged) |

**Employee home (`/home`):**
- Hero: **Scan vehicle** (primary, full-width on mobile) → `/scan` or opens `QRScannerModal`.
- Secondary: **My recent inspections** (last 5 for current user).
- Optional: assigned/open task for today if `FleetTask` exists.
- No manager KPI grid.

**Implementation:** `page.tsx` checks `useAuth().role` after hydration and redirects; add `src/app/home/page.tsx`.

### 4.2 Dashboard (manager) — reference parity

Keep current grid; enhance when data exists:

| Widget | Enhancement |
|--------|-------------|
| Today's activity | Already present — ensure links to inspection/issue detail |
| Mini calendar | Click day → `/calendar?date=YYYY-MM-DD` |
| Open issues | Show top 5 with type badge; link to `/issues?issue=` |
| Vehicles in use | Table: vehicle, user, start time, last inspection status (use `currentUserStartTime`, `lastInspectionStatus`) |
| Recent inspections | Last 5 with status badges |

Empty states use `.empty` + single CTA (seed demo data hint for first-time managers).

### 4.3 Navigation

- `Sidebar` `NAV_ITEMS`: add **Home** for employees only (or hide Dashboard for employees).
- Employees see: Home, Inspections, Scan (bottom CTA remains).
- Managers see: full list (unchanged).

### 4.4 Calendar deduplication

- Dashboard widget stays as **summary** (no duplicate full calendar logic).
- Extract `getDayStatus` + month nav into `src/components/InspectionCalendar.tsx` shared by dashboard and `/calendar`.

---

## 5. Employee flows (field / mobile)

### 5.1 Inspect (`InspectClient.tsx`)

| Improvement | Detail |
|-------------|--------|
| Progress | Sticky top bar: "Answered X / Y required" + thin progress bar |
| Category jump | Sticky horizontal chip nav (category titles); scroll-into-view on tap |
| Submit state | Keep strict validation; helper text uses tokens |
| Success screen | Show `RecentInspectors` for vehicle; clear **Scan another** CTA |
| Remove misleading "All Clear" before any answers | Badge only when all required answered and zero flags |

### 5.2 Scan pages

- `/scan` and equipment scan: migrate to `.page` / `.btn` tokens.
- Consistent post-scan routing: vehicle → `/inspect?id=`; equipment → scan client.

### 5.3 Touch targets

- All primary actions ≥ `--tap` (44px) on inspect and scan flows.
- Flag notes textarea: min-height comfortable for one-handed use.

---

## 6. Manager flows (desktop + tablet)

### 6.1 Issues (`issues/page.tsx`)

| Improvement | Detail |
|-------------|--------|
| Design system migration | Cards, filters, list rows use tokens |
| Type override | Dropdown uses token badges (already partially done) |
| Quick actions | **Update Stock** / **Remove from Van** open `QuantityModal` — never silent `prompt()` |
| Stock context | Row shows `Held X / Required Y` when `requiredQuantity` set; amber when held < required |
| Recent inspectors | Keep `RecentInspectors` on selected issue |

### 6.2 Equipment & vehicles

| Page | Improvement |
|------|-------------|
| `equipment/page.tsx` | Token migration; In Shop / vehicle columns use `.card` lists |
| `vehicles/page.tsx` | Delete modal uses `.btn-danger`; token spacing |
| `VehicleDetailClient.tsx` | Par qty inline input (not prompt); Return to shop → `QuantityModal`; Held/Required label |

### 6.3 Settings

- Tabbed sections: **Checklist** | **Equipment options** | **Tasks** | **Appearance** | **Danger zone**.
- Appearance: theme toggle + recent inspectors depth (existing).

### 6.4 Modals over prompts

Replace `window.prompt` / `window.confirm` on manager inventory/issue paths with `QuantityModal` / `ConfirmModal`. Keep `alert()` only for hard errors until toast component exists (optional: simple `Toast` later — out of scope).

---

## 7. Data & backend touchpoints

No schema migration. UI reads existing APIs:

| Feature | API / field |
|---------|-------------|
| Held / required | `assignments[].quantity`, `assignments[].requiredQuantity` |
| Recent inspectors | `getRecentInspectors(vehicleId)` |
| Stock quick actions | `resolveStockIssue` (already validates qty) |
| Theme | `AppSettings.theme` (new optional field) |
| Employee recent inspections | `getInspections()` filtered by `userId` |

---

## 8. Migration order (implementation phases)

| Phase | Deliverable | Pages / files |
|-------|-------------|---------------|
| **1 — Foundation** | `PageHeader`, modals, `InspectionCalendar`, header title fix, main width, mobile drawer tokens | `layout.tsx`, `Header.tsx`, new components |
| **2 — Shell routes** | Employee `/home`, role redirect, sidebar nav split | `page.tsx`, `home/page.tsx`, `Sidebar.tsx` |
| **3 — High-traffic manager** | Issues, vehicles, equipment token migration + quantity modals | `issues/`, `vehicles/`, `equipment/` |
| **4 — Field** | Inspect progress + category nav + success inspectors | `InspectClient.tsx` |
| **5 — Long tail** | inspections, employees, settings tabs, calendar, reports, scan clients | remaining `src/app/**` |
| **6 — Polish** | Dark mode toggle, dashboard table enhancements, empty-state CTAs | `settings/`, `dashboard/` |

Each phase should leave the app buildable (`npm run build`) and testable (`npm test`).

---

## 9. Testing

| Area | Test |
|------|------|
| Inspection validation | Existing `inspectionValidation.test.tsx` — unchanged behavior |
| Quantity modal logic | Unit test: empty string rejected; 0 allowed only when explicit |
| Role redirect | Optional: small test for redirect path given role (if extracted pure helper) |
| Visual | Manual smoke: employee home on 375px width; manager dashboard on 1280px; GitHub Pages hard-refresh |

No Playwright in this spec.

---

## 10. Success criteria

- No visible `sky-600` / `slate-500` on migrated pages (grep check in PR).
- Header title matches current route on desktop and mobile.
- Employee signing in lands on scan-first home, not empty manager dashboard.
- Issue quick actions use modals; blank quantity cannot resolve an issue.
- Vehicle detail shows Held/Required when par is set.
- Inspect shows progress and does not show "All Clear" before answers.
- `npm test` and `npm run build` pass.
- GitHub Pages matches localhost after deploy (same branch, hard-refresh).

---

## 11. Out of scope

- Splitting `db.ts` into modules.
- Push notifications / email alerts.
- Offline PWA / service worker.
- Replacing localStorage with server-only persistence.
