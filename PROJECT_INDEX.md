# PROJECT_INDEX.md

**Sunny Fleet Accountability** — Next.js 14 App Router (static export, `output: 'export'`), TypeScript, Tailwind. Fleet vehicle/equipment inspection tracking with QR scanning. Data lives in `localStorage` with optional Firestore sync via a single `dbService` singleton.

## Layout / Shell UI
- `src/app/layout.tsx` — Root layout: `AuthProvider`, `ThemeInit`, desktop sidebar + mobile drawer, `Header`, floating "Scan QR" button, and the global `QRScannerModal`.
- `src/components/Header.tsx` — Sticky top bar: mobile menu toggle, page title via `getPageTitle()`, demo-data reset, notification bell (open issues), and the user/role-switcher dropdown.
- `src/components/Sidebar.tsx` — Primary nav from `NAV_ITEMS` (`src/lib/navItems.ts`) with `managerOnly` / `employeeOnly` role gating; highlights the active route via `usePathname`.
- `src/components/ThemeInit.tsx` — On mount, reads `AppSettings.theme` and calls `applyAppTheme()` so dark mode applies before paint.
- `src/lib/theme.ts` — `applyAppTheme()` sets `document.documentElement.dataset.theme` (`light` | `dark`).
- `src/lib/navItems.ts` — Shared `NAV_ITEMS` catalog (label, href, icon, role flags) for sidebar and title resolution.
- `src/lib/pageTitles.ts` — `getPageTitle(pathname)` and `PAGE_TITLES` overrides; derives labels from `NAV_ITEMS`.
- `src/lib/roleHome.ts` — `getHomePath(role)` → `/home` (employee) or `/dashboard` (manager).
- `src/components/StatusBadges.tsx` — Colored pill badges for inspection, issue, vehicle, and equipment statuses.
- `src/components/ManagerOnly.tsx` — URL-level role guard wrapping every manager page; `requireTrueManager` excludes temporary admins from account control.
- `src/app/globals.css` — Tailwind layers plus global base styles, `[data-theme="dark"]` tokens, and animation utilities.

## Pages / Routes
- `src/app/page.tsx` + `HomeRedirect.tsx` — Index route; role-aware redirect via `getHomePath()` → `/home` or `/dashboard`.
- `src/app/home/page.tsx` — Employee scan-first home: prominent "Scan vehicle" CTA, open assigned fleet task, and recent personal inspections (`EmptyState` when none).
- `src/app/dashboard/page.tsx` — KPI tiles, recent activity, and compact `InspectionCalendar` widget.
- `src/app/vehicles/page.tsx` — Vehicle roster with create/edit/delete, equipment counts, and QR code access (manager).
- `src/app/vehicles/detail/page.tsx` + `VehicleDetailClient.tsx` — Single-vehicle view (`?id=`/QR lookup): assigned equipment, shop transfers, inspection and issue history.
- `src/app/inspections/page.tsx` — Completed inspection log with filtering, detail expansion, and delete.
- `src/app/inspect/page.tsx` + `InspectClient.tsx` — The inspection workflow itself: loads the checklist config, walks questions by category, and submits results (auto-raising issues).
- `src/app/scan/page.tsx` — Standalone vehicle QR scan/lookup page that routes into an inspection.
- `src/app/equipment/page.tsx` — Equipment/supply catalog with status filters, global inventory summary, and CRUD.
- `src/app/equipment/scan/page.tsx` + `EquipmentScanClient.tsx` — Equipment QR scan: identify an item and transfer quantities between shop and vehicles.
- `src/app/issues/page.tsx` — Reported issue queue with status tracking, auto/overridden issue types, and stock quick actions (Update Stock / Remove from Van); deep-linkable via `?issue=`.
- `src/app/employees/page.tsx` — User management (create/edit/delete), access-passcode assignment with reveal/copy, and per-employee inspection and issue stats.
- `src/app/calendar/page.tsx` — Full-month `InspectionCalendar` of inspections and issues by date.
- `src/app/reports/page.tsx` — Report generation with persisted `ReportSettings`.
- `src/app/settings/page.tsx` — Manager-gated admin console: checklist categories/questions, equipment options, fleet tasks, app theme (light/dark), recent-inspectors depth (1 or 3), and the danger zone factory reset.
- `src/app/not-found.tsx` + `src/components/NotFoundRedirect.tsx` — 404 handler that recovers deep links under static export.
- `src/components/SPARedirectHandler.tsx` — Restores the intended path after the `404.html` redirect trick used by GitHub Pages hosting.

## QR / Modals / Shared Components
- `src/components/PageHeader.tsx` — Reusable page title block: `title`, optional `subtitle`, and trailing `actions` slot (`.page-head` layout).
- `src/components/ConfirmModal.tsx` — Generic confirm/cancel dialog; `variant: 'danger'` for destructive actions.
- `src/components/QuantityModal.tsx` — Numeric input modal for stock/assignment qty changes (uses `parseQuantityInput` from `src/lib/quantityModal.ts`).
- `src/components/EmptyState.tsx` — Centered empty-list placeholder: icon, title, body copy, optional action.
- `src/components/InspectionCalendar.tsx` — Month grid marking inspection/issue days; `compact` mode for dashboard embed; optional `onDayClick`.
- `src/components/QRScannerModal.tsx` — Global camera scanner (`html5-qrcode`) that resolves a scanned code to a vehicle and navigates.
- `src/components/QRCodeDisplay.tsx` — Renders/prints/downloads a vehicle QR code.
- `src/components/EquipmentQRCodeDisplay.tsx` — Same for equipment items.
- `src/components/IssueTimeline.tsx` — Chronological issue status history with inline status updates.
- `src/components/RecentInspectors.tsx` — Shows the last 1 or 3 completed inspectors for a vehicle (depth from `AppSettings`).
- `src/components/ProfileModal.tsx` — Avatar preset picker and profile editing for the signed-in user.
- `src/components/PasscodeGate.tsx` — Passcode keypad: `PasscodeGate` locks the whole shell until a valid session exists; `PasscodePrompt` re-authenticates mid-scan when the shift session lapses.

## State / Data / Services
- `src/context/AuthContext.tsx` — `AuthProvider` + `useAuth()`: current user, role, `switchUser`, and `availableUsers` (demo RBAC switching).
- `src/lib/db.ts` — The core `dbService` singleton: all vehicle/equipment/inspection/issue/user/checklist reads and writes, `AppSettings` (`recentInspectorsDepth`, `theme`), `getRecentInspectors()`, stock issue resolution (`resolveStockIssue`), `localStorage` persistence, Firestore sync, seeding, and the `sunny_db_update` change event.
- `src/lib/issueClassification.ts` — Auto-classifies issues into `IssueType` (`stock_low_inventory`, `equipment_replacement`, `needs_repair`); overridable in the issues UI.
- `src/lib/__tests__/inventory.test.ts` — Vitest: return-to-shop, multi-qty assign, catalog delete cascade, vehicle delete, `resolveStockIssue`.
- `src/lib/__tests__/issueClassification.test.ts` — Vitest: issue type detection heuristics.
- `src/lib/__tests__/appSettings.test.ts` — Vitest: `getRecentInspectors` respects depth 1 vs 3.
- `src/lib/firebase.ts` — Firebase app/auth/Firestore initialization plus `ensureAuth()` anonymous sign-in.
- `src/lib/mockData.ts` — `INITIAL_*` seed data (users, vehicles, equipment, checklist categories/questions).
- `src/lib/avatarPresets.ts` — Avatar preset catalog and `getResolvedAvatarUrl()` / role-default helpers.
- `src/types/index.ts` — Central domain model: `User`, `Vehicle`, `Equipment`, `Inspection`, `Issue`, `IssueType`, `AppSettings`, `ChecklistQuestion`, and their status unions.

## Config
- `next.config.mjs` — Static export, `basePath`/`assetPrefix` for `/sunny` hosting, unoptimized images, strict mode off (protects the camera scanner).
- `tailwind.config.ts` — Tailwind content globs, theme extensions, and custom animations.
- `tsconfig.json` — TS compiler options and the `@/*` → `src/*` path alias.
- `postcss.config.js` — Tailwind/autoprefixer pipeline.
- `package.json` — Scripts (`dev`, `build` also copies `public/404.html` into `out/`, `test`/`test:watch` via Vitest) and dependencies.
- `vitest.config.ts` — Vitest + jsdom test runner with `@/*` path alias.
- `public/404.html` — SPA fallback enabling client-side deep links on static hosts.

## Docs
- `how_to_run.md` — Local dev and build instructions.
- `docs/superpowers/specs/2026-08-19-vehicle-equipment-accountability-design.md` — Design spec for the accountability model.
- `docs/superpowers/specs/2026-08-25-inventory-inspection-issues-design.md` — Inventory, single-page inspection, issue types, and stock quick actions.
- `docs/superpowers/plans/2026-08-25-inventory-inspection-issues.md` — Implementation plan for the inventory/inspection/issues workstream.
- `TODO/todo.md` — Outstanding work items.
