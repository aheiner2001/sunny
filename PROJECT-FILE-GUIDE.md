# Project file guide — where to look (no AI required)

**Parent folder:** `sunny/`  
**Purpose:** Tell you exactly which files to open for each kind of work in Sunny Fleet Accountability.

**Cursor skill:** `@sunny-navigation` — teaches the agent to read this guide first.

**Related docs:**
- File index (AI-oriented): `PROJECT_INDEX.md`
- How to run / build: `how_to_run.md`
- Design specs: `docs/superpowers/specs/`
- Implementation plans: `docs/superpowers/plans/`

---

## 0. The one rule

| Question | Answer |
|----------|--------|
| What do I **run**? | `npm run dev` → [http://localhost:3000](http://localhost:3000) |
| What do I **load** / open to edit? | `sunny/` — pages in `src/app/`, shared UI in `src/components/`, logic in `src/lib/` |
| Where does build / deploy compile from? | `npm run build` writes static files to `out/` (not committed) |
| After `git pull`? | `npm install` if `package-lock.json` changed, then `npm run dev`. Hard-refresh the browser (`Cmd+Shift+R`). On GitHub Pages, wait ~2 min for the deploy workflow, then hard-refresh. |

**Official upstream:** https://github.com/aheiner2001/sunny  
**Live site:** https://aheiner2001.github.io/sunny/

---

## 1. Decision tree — which files?

```
What are you changing?
│
├─ Look & feel (colors, spacing, fonts, global layout)
│  └─► src/app/globals.css  (+ tailwind.config.ts for tokens)
│
├─ A specific page (dashboard, vehicles, inspect, …)
│  └─► src/app/<route>/page.tsx  (and *Client.tsx if the route has one)
│
├─ Shell (sidebar, header, nav, mobile drawer)
│  └─► src/app/layout.tsx  +  src/components/Sidebar.tsx  +  src/components/Header.tsx  +  src/lib/navItems.ts
│
├─ Design system (page headers, modals, empty states, calendar widget)
│  └─► src/components/PageHeader.tsx  +  ConfirmModal.tsx  +  QuantityModal.tsx  +  EmptyState.tsx  +  InspectionCalendar.tsx
│
├─ Employee home / role landing
│  └─► src/app/home/page.tsx  +  src/lib/roleHome.ts  +  src/app/HomeRedirect.tsx
│
├─ Dark mode / theme
│  └─► src/lib/theme.ts  +  src/components/ThemeInit.tsx  +  Settings → App theme  +  src/app/globals.css (`[data-theme="dark"]`)
│
├─ Data rules (inventory counts, inspections, issues, users)
│  └─► src/lib/db.ts  (+ types in src/types/index.ts)
│
├─ Demo seed data (default vans, users, checklist)
│  └─► src/lib/mockData.ts
│
├─ Checklist questions / categories / equipment presets (manager Settings UI)
│  └─► src/app/settings/page.tsx  →  dbService checklist + equipment option APIs
│
├─ QR scan / camera
│  └─► src/components/QRScannerModal.tsx  +  scan pages under src/app/scan/ and src/app/equipment/scan/
│
├─ Auth / passcodes / roles
│  └─► src/context/AuthContext.tsx  +  src/components/PasscodeGate.tsx  +  dbService user/session methods
│
├─ Firebase / cloud sync
│  └─► src/lib/firebase.ts  +  dbService Firestore listeners / sync methods
│
├─ GitHub Pages paths / broken images / wrong URLs on deploy
│  └─► next.config.mjs  +  src/lib/basePath.ts  +  public/404.html
│
├─ Automated tests
│  └─► src/lib/__tests__/*.test.ts  +  src/app/inspect/inspectionValidation.test.tsx
│
└─ Deploy / CI
   └─► .github/workflows/deploy.yml  +  .github/workflows/nextjs.yml
```

---

## 2. Task index — “I want to…” → open these files

### Run / test / debug

| I want to… | Files / actions |
|------------|-----------------|
| Run locally | `npm install` then `npm run dev` → http://localhost:3000 |
| Run unit tests | `npm test` (Vitest; see `vitest.config.ts`) |
| Watch tests | `npm run test:watch` |
| Production build | `npm run build` → output in `out/` |
| Lint | `npm run lint` |
| See what shipped to GitHub Pages | Push to `main`; workflow `.github/workflows/deploy.yml` builds with `NEXT_PUBLIC_BASE_PATH=/sunny` |
| Reset demo data in the UI | Header → demo reset, or Settings danger zone → uses `dbService.resetToDefaults()` / `clearAllData()` |
| Read runtime errors | Browser DevTools console; camera/QR issues often need HTTPS or localhost |

### Pages & product features

| I want to… | Primary files |
|------------|---------------|
| Change the dashboard layout / KPIs | `src/app/dashboard/page.tsx` (uses compact `InspectionCalendar`) |
| Employee home (scan-first landing) | `src/app/home/page.tsx` |
| Role-based index redirect | `src/app/page.tsx` + `HomeRedirect.tsx` + `src/lib/roleHome.ts` |
| Manage vehicles (list, add, delete, QR) | `src/app/vehicles/page.tsx` |
| Vehicle detail (equipment on van, history) | `src/app/vehicles/detail/VehicleDetailClient.tsx` |
| Run an inspection (checklist, submit) | `src/app/inspect/InspectClient.tsx` |
| Inspection validation (required answers) | `src/app/inspect/inspectionValidation.ts` |
| View completed inspections | `src/app/inspections/page.tsx` |
| Equipment catalog / shop inventory | `src/app/equipment/page.tsx` |
| Transfer equipment via QR | `src/app/equipment/scan/EquipmentScanClient.tsx` |
| Issue queue + stock quick actions | `src/app/issues/page.tsx` |
| Employees / passcodes | `src/app/employees/page.tsx` |
| Calendar of inspections & issues | `src/app/calendar/page.tsx` + `src/components/InspectionCalendar.tsx` |
| Reports | `src/app/reports/page.tsx` |
| Admin: checklist, tasks, app settings | `src/app/settings/page.tsx` (includes light/dark theme) |
| Scan vehicle QR (standalone) | `src/app/scan/page.tsx` |

### Data & business logic

| I want to… | Primary files |
|------------|---------------|
| Change how inventory assign/return works | `src/lib/db.ts` — `transferEquipmentQuantity`, `returnEquipmentToShop`, `setVehicleAssignmentQuantity` |
| Vehicle delete (return stock vs delete equipment) | `src/lib/db.ts` — `deleteVehicle` + `src/app/vehicles/page.tsx` delete modal |
| Create issues from inspections | `src/lib/db.ts` — `submitInspection` + `src/lib/issueClassification.ts` |
| Resolve low-stock issues in one click | `src/lib/db.ts` — `resolveStockIssue` + `src/app/issues/page.tsx` |
| Show who last inspected a van | `src/lib/db.ts` — `getRecentInspectors` + `src/components/RecentInspectors.tsx` |
| Change issue type labels / auto-classify rules | `src/types/index.ts` (`IssueType`) + `src/lib/issueClassification.ts` |
| Edit domain types (Vehicle, Equipment, Issue, …) | `src/types/index.ts` |
| Change default seed users/vans/checklist | `src/lib/mockData.ts` |
| Add a new nav item | `src/lib/navItems.ts` — `NAV_ITEMS` (`managerOnly` / `employeeOnly` flags); titles via `src/lib/pageTitles.ts` |
| Reusable page title + actions row | `src/components/PageHeader.tsx` |
| Confirm / quantity dialogs | `src/components/ConfirmModal.tsx`, `QuantityModal.tsx` |
| Empty list placeholder | `src/components/EmptyState.tsx` |
| Toggle dark mode | Settings → App theme; persisted in `AppSettings.theme` via `dbService.saveAppSettings` |

### Styling & branding

| I want to… | Primary files |
|------------|---------------|
| Global colors, fonts, spacing tokens | `src/app/globals.css` (`:root` + `[data-theme="dark"]` CSS variables) |
| Apply theme on load | `src/components/ThemeInit.tsx` + `src/lib/theme.ts` (`applyAppTheme`) |
| Tailwind theme extensions (`sunny` palette) | `tailwind.config.ts` |
| Page-specific layout classes | The relevant `src/app/**/page.tsx` or `*Client.tsx` |
| Status pill colors | `src/components/StatusBadges.tsx` |
| Logo / static images | `public/` (`logo.png`, `sunny-logo.png`) |

### Hosting & paths

| I want to… | Primary files |
|------------|---------------|
| Change GitHub Pages subpath (`/sunny`) | `next.config.mjs` **and** `src/lib/basePath.ts` (keep in sync) |
| Fix 404 on deep links (e.g. `/vehicles/detail?id=van-1`) | `public/404.html` + `src/components/SPARedirectHandler.tsx` + `src/components/NotFoundRedirect.tsx` |
| Hand-built asset URLs (QR, images) | `src/lib/basePath.ts` — `asset('/path')` |

### Tests

| I want to… | File |
|------------|------|
| Inventory assign/return/delete rules | `src/lib/__tests__/inventory.test.ts` |
| Issue type heuristics | `src/lib/__tests__/issueClassification.test.ts` |
| Recent inspectors depth setting | `src/lib/__tests__/appSettings.test.ts` |
| Inspection submit gating | `src/app/inspect/inspectionValidation.test.tsx` |

---

## 3. Build pipeline (source → running app)

**Flow:**

```
src/app/**  +  src/components/**  +  src/lib/**
        →  next build  (static export)
        →  out/          (deployed to GitHub Pages)
        →  browser loads HTML/JS
        →  dbService.init() seeds localStorage if empty
        →  optional Firestore listeners sync cloud data
        →  pages read/write via dbService + sunny_db_update events
```

| Step | File |
|------|------|
| App entry / shell | `src/app/layout.tsx` |
| Route pages | `src/app/<route>/page.tsx` |
| Data layer | `src/lib/db.ts` (`dbService` singleton) |
| Static export config | `next.config.mjs` (`output: 'export'`, `basePath`) |
| CI build + deploy | `.github/workflows/deploy.yml` |
| Type definitions | `src/types/index.ts` |

**After changing `next.config.mjs` or `basePath`:** run `npm run build` locally and spot-check asset URLs under `/sunny/…` before pushing.

---

## 4. Complete file list — `sunny/`

**You edit these for day-to-day product work.**

```
sunny/
├── src/app/
│   ├── layout.tsx                    ★ Shell: sidebar, header, auth gate, ThemeInit, QR FAB
│   ├── globals.css                   ★ Design tokens, dark theme, global typography
│   ├── page.tsx                      Role redirect via HomeRedirect
│   ├── HomeRedirect.tsx              getHomePath() → /home or /dashboard
│   ├── home/page.tsx                 ★ Employee scan-first home
│   ├── dashboard/page.tsx            ★ Manager dashboard KPIs + compact calendar
│   ├── vehicles/
│   │   ├── page.tsx                  ★ Vehicle roster CRUD + delete modal
│   │   └── detail/VehicleDetailClient.tsx  ★ Per-van equipment, history, inspectors
│   ├── inspect/
│   │   ├── InspectClient.tsx         ★ Live inspection checklist + submit
│   │   ├── inspectionValidation.ts   ★ canSubmitInspection() helper
│   │   └── page.tsx                  Route wrapper
│   ├── inspections/page.tsx          Completed inspection log
│   ├── equipment/
│   │   ├── page.tsx                  ★ Global inventory catalog
│   │   └── scan/EquipmentScanClient.tsx  ★ QR transfer to/from shop
│   ├── issues/page.tsx               ★ Issue queue, types, quick actions
│   ├── employees/page.tsx            User / passcode management
│   ├── calendar/page.tsx             Full-month InspectionCalendar
│   ├── reports/page.tsx              Report settings + generation
│   ├── settings/page.tsx             ★ Checklist, tasks, app settings, danger zone
│   └── scan/page.tsx                 Standalone vehicle QR → inspect
├── src/components/
│   ├── Sidebar.tsx                   ★ NAV_ITEMS filter + role gating
│   ├── Header.tsx                    ★ Top bar, getPageTitle(), notifications, user menu
│   ├── PageHeader.tsx                Reusable page title + actions row
│   ├── ConfirmModal.tsx              Generic confirm/cancel dialog
│   ├── QuantityModal.tsx             Numeric qty input for stock/assign flows
│   ├── EmptyState.tsx                Empty-list placeholder
│   ├── InspectionCalendar.tsx        Month grid (full or compact)
│   ├── ThemeInit.tsx                 Applies AppSettings.theme on mount
│   ├── StatusBadges.tsx              Status pill styling
│   ├── QRScannerModal.tsx            ★ Global camera scanner
│   ├── RecentInspectors.tsx          Last N inspectors list
│   ├── IssueTimeline.tsx             Issue status history UI
│   ├── PasscodeGate.tsx              Login keypad + session gate
│   ├── ManagerOnly.tsx               Redirect non-managers
│   └── SPARedirectHandler.tsx        GitHub Pages deep-link recovery
├── src/lib/
│   ├── db.ts                         ★ All persistence + business rules
│   ├── mockData.ts                   ★ Default seed data
│   ├── issueClassification.ts        Auto issue-type heuristics
│   ├── firebase.ts                   Firebase init + anonymous auth
│   ├── basePath.ts                   ★ /sunny prefix for hand-built URLs
│   ├── navItems.ts                   ★ NAV_ITEMS (sidebar + title source)
│   ├── pageTitles.ts                 getPageTitle() for Header
│   ├── roleHome.ts                   getHomePath() role landing
│   ├── theme.ts                      applyAppTheme() — sets data-theme
│   └── __tests__/                    Vitest suites
├── src/types/index.ts                ★ Domain model (Vehicle, Issue, Equipment, …)
├── src/context/AuthContext.tsx       Current user + role switching
├── next.config.mjs                   ★ Static export + basePath
├── tailwind.config.ts                ★ Tailwind theme
├── package.json                      Scripts: dev, build, test
├── vitest.config.ts                  Test runner config
├── public/404.html                   SPA fallback for GitHub Pages
├── how_to_run.md                     Run/build commands
├── PROJECT_INDEX.md                  AI-oriented file index
└── docs/superpowers/                 Design specs + plans
```

**Do not commit unless intentional:** `node_modules/`, `.next/`, `out/`, `tsconfig.tsbuildinfo`, `.env.local`

---

## 5. `src/lib/db.ts` — what lives where

| Responsibility | Method / area |
|----------------|----------------|
| First load / seed demo data | `init()`, `resetToDefaults()` |
| localStorage keys | `STORAGE_KEYS` (top of file) |
| UI refresh after data change | `window.dispatchEvent('sunny_db_update')` |
| Vehicles CRUD | `getVehicles`, `createVehicle`, `updateVehicle`, `deleteVehicle` |
| Inventory assign / return / par | `transferEquipmentQuantity`, `returnEquipmentToShop`, `setVehicleAssignmentQuantity`, `setAssignmentRequiredQuantity` |
| Equipment catalog | `getEquipment`, `createEquipment`, `updateEquipment`, `deleteEquipment` |
| Inspections | `submitInspection`, `getInspections`, `getRecentInspectors` |
| Issues | `getIssues`, `updateIssueStatus`, `updateIssueType`, `resolveStockIssue` |
| Checklist config | `getChecklistQuestions`, `saveChecklistConfig`, `resetChecklistToDefaults` |
| Users / passcodes / sessions | `getUserByPasscode`, `createSession`, `createUser`, … |
| App settings (inspector depth, theme) | `getAppSettings`, `saveAppSettings` |
| Firestore sync | `setupFirestoreListeners`, `syncAllToFirestore` |

**Exported singleton:** `dbService` — import from `@/lib/db` everywhere.

---

## 6. Config & data — what people actually edit

### Manager Settings UI (persisted via dbService)

| What | Where it lives | localStorage key |
|------|----------------|------------------|
| Checklist categories | Settings → Checklist | `sunny_checklist_categories` |
| Checklist questions | Settings → Checklist | `sunny_checklist_questions` |
| Equipment name presets | Settings → Equipment options | `sunny_equipment_options` |
| Fleet tasks | Settings → Tasks | `sunny_tasks` |
| Recent inspectors depth (1 or 3) | Settings → App | `sunny_app_settings` |
| App theme (light / dark) | Settings → App | `sunny_app_settings` (`theme`) |
| Report metrics | Reports page | `sunny_report_settings` |

### Seed data (factory reset restores these)

| Data | File | IDs to know |
|------|------|-------------|
| Demo users | `src/lib/mockData.ts` | `user-jacob` (manager), `user-john` (employee); passcodes `4321` / `1234` |
| Demo vehicles | `src/lib/mockData.ts` | `van-1`, QR token `van-1` |
| Demo equipment | `src/lib/mockData.ts` | `eq-1`, … |
| Default checklist | `src/lib/mockData.ts` | config id `standard-detailing-checklist` |

### Environment (optional cloud sync)

| File | Use |
|------|-----|
| `.env.local` | Firebase keys (not in git; see `src/lib/firebase.ts`) |

---

## 7. Source vs generated / browser storage

| Location | What it is |
|----------|------------|
| `src/` | **Source of truth** — edit here, commit to git |
| `out/` | Static build output — regenerated by `npm run build`; deployed to GitHub Pages |
| `.next/` | Next dev/build cache — safe to delete |
| Browser `localStorage` | Runtime database for the demo app (`sunny_*` keys) — per-browser, not in git |
| Firestore (optional) | Cloud copy when Firebase is configured and synced |

| Action | Result |
|--------|--------|
| Edit `src/` + save | Hot reload in `npm run dev` |
| `npm run build` | Regenerates `out/` from `src/` |
| `git pull` | Updates `src/` only — restart dev server; refresh browser |
| Factory reset in app | Wipes `localStorage`, re-seeds from `mockData.ts` |
| Clear site data in browser | Same as wipe — app re-seeds on next visit |

---

## 8. Git branches

| Branch | Contents |
|--------|----------|
| `main` | Production; auto-deploys to GitHub Pages on push |
| `styling` | Merged via PR #1; keep in sync or delete when done |

**Pull strategy:** `git pull origin main` then `npm install` if lockfile changed.

---

## 9. Symptoms → first file to open

| Symptom | Open first |
|---------|------------|
| Wrong spacing / colors locally vs GitHub | Compare branches; hard-refresh GitHub. Then `src/app/globals.css`, `tailwind.config.ts` |
| Images or links 404 on GitHub Pages only | `src/lib/basePath.ts`, `next.config.mjs` — hand-built URLs need `asset()` |
| Deep link 404 on GitHub Pages (works on localhost) | `public/404.html`, `SPARedirectHandler.tsx` |
| Inventory counts wrong after assign/return | `src/lib/db.ts` transfer/return methods; then `src/app/equipment/page.tsx` |
| Can’t assign more than one unit to a van | `VehicleDetailClient.tsx` + `transferEquipmentQuantity` in `db.ts` |
| Inspection submit stays disabled | `InspectClient.tsx`, `inspectionValidation.ts` |
| Issues missing type or wrong quick actions | `issueClassification.ts`, `issues/page.tsx`, `resolveStockIssue` in `db.ts` |
| Nav item missing or wrong role | `src/lib/navItems.ts` — `NAV_ITEMS` + `managerOnly` / `employeeOnly` |
| Header title wrong | `src/lib/pageTitles.ts` — `getPageTitle()` + `PAGE_TITLES` overrides |
| Employee lands on dashboard (or vice versa) | `src/lib/roleHome.ts`, `HomeRedirect.tsx` |
| Dark mode not sticking on reload | `ThemeInit.tsx`, `theme.ts`, `AppSettings.theme` in `db.ts` |
| QR scanner won’t start / double-mount | `next.config.mjs` (`reactStrictMode: false`); `QRScannerModal.tsx` |
| Data doesn’t refresh after edit | Listener on `sunny_db_update` in the page component |
| Tests fail after db change | `src/lib/__tests__/inventory.test.ts` |
| Deploy didn’t update live site | GitHub Actions → “Deploy Next.js site to Pages”; confirm push was to `main` |
| Edits vanished after pull | You may have been editing a git worktree copy — confirm path is `sunny/` on `main` |

---

## 10. What NOT to edit (common traps)

| Don’t | Why |
|-------|-----|
| Edit files in `out/` or `.next/` | Generated; overwritten on every build |
| Change only `next.config.mjs` without `basePath.ts` | Hand-built URLs break on GitHub Pages |
| Put business rules only in a page component | Other pages won’t see it — use `dbService` |
| Commit `.env.local` | Secrets; gitignored for a reason |
| Expect `npm run start` for this project’s deploy | App uses static export (`out/`); production is GitHub Pages, not Node server |
| Open the copilot worktree folder thinking it’s canonical | Canonical repo is `sunny/` on `main` unless you intentionally work there |
| Rely on `how_to_run.md` alone for deploy | It mentions `.next`; actual static output is `out/` (see `package.json` build script) |

---

## 11. Minimal daily workflow (copy/paste)

```bash
cd ~/Sandbox/sunny    # or your clone path
git pull origin main
npm install           # only if package-lock.json changed
npm run dev           # http://localhost:3000
```

Before pushing UI changes you care about on GitHub:

```bash
npm test
npm run build
git add -p
git commit -m "your message"
git push origin main
# wait ~2 min for GitHub Actions, then hard-refresh https://aheiner2001.github.io/sunny/
```

Pick **one** page or **one** `dbService` method per task — see section 2.

---

*Last updated for the `sunny/` Next.js static-export layout. If folders move, search for `dbService`, `InspectClient`, and `globals.css`.*
