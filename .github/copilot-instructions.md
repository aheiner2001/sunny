# Copilot instructions for Sunny Fleet

## Project overview

Sunny Fleet is a mobile-first fleet accountability dashboard built with Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, and Lucide icons. The app supports manager-facing fleet views and an employee inspection flow reached from vehicle QR codes.

The project is configured for a static export (`output: 'export'`) and is deployed to GitHub Pages under `/sunny` in production. `NEXT_PUBLIC_BASE_PATH` can override that path; local development normally runs without a base path. Images are unoptimized because the deployment is static.

## Build, run, and lint

Use npm and the checked-in `package-lock.json`:

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static production build; also copies public/404.html to out/404.html
npm run start     # serve a completed Next build
npm run lint      # Next.js lint
```

There is no test script, test directory, or configured test runner. Consequently, there is no supported single-test command; validate behavior with the relevant route in the dev server and use `npm run lint` and `npm run build` for code changes. CI uses Node 22, `npm ci`, and the static `out` artifact for GitHub Pages.

## Architecture

- `src/app/` contains the App Router routes. Most route pages are client components because they read browser storage, use Firebase listeners, access camera APIs, or manage interactive forms. `src/app/inspect/page.tsx` and `src/app/vehicles/detail/page.tsx` wrap their client implementations in `Suspense` because they read search parameters.
- `src/components/` contains the shared shell and cross-route UI: `layout.tsx` mounts `AuthProvider`, the responsive sidebar/header, the global mobile QR scanner, and `SPARedirectHandler`.
- `src/context/AuthContext.tsx` provides the current demo user, role, account switching, and profile updates. This is a local/demo role switcher, not server-enforced authentication.
- `src/lib/db.ts` (`dbService`) is the application data boundary. It exposes CRUD and query methods for users, vehicles, equipment, checklist configuration, inspections, and issues. In the browser it writes localStorage first, then best-effort synchronizes to Cloud Firestore and broadcasts `sunny_db_update` so mounted pages reload their data.
- `src/lib/firebase.ts` initializes Firebase and anonymously signs the browser into Firebase Auth before Firestore operations/listeners. Public `NEXT_PUBLIC_FIREBASE_*` variables may override the built-in project configuration.
- `src/lib/mockData.ts` supplies the initial local demo state: users, one vehicle, one equipment item, checklist categories/questions, and empty inspection/issue collections. `dbService` seeds this state on first browser load and can reset it from the header.
- `src/types/index.ts` is the shared domain model. Keep changes to Firestore/localStorage records aligned with these interfaces and with the checklist/issue schema described in `docs/superpowers/specs/2026-08-19-vehicle-equipment-accountability-design.md`.
- `src/app/settings/page.tsx` edits the single `checklists/standard-detailing-checklist` document, including category order and question order. Inspection UI reads that configuration dynamically.
- Settings also persists manager equipment options, per-question issue-reason presets, fleet tasks, and report metric selections through `dbService`; vehicle creation consumes the equipment-option list while still accepting custom one-off entries.
- The Equipment route supports an equipment-first view and a collapsible vehicle-grouped view. Preserve both filtering modes when changing inventory UI.
- Equipment records support optional QR tokens, reusable tools, consumable stock, per-vehicle quantity assignments, and shared/unassigned inventory. Use the equipment scan route and `dbService.transferEquipmentQuantity` for confirmed transfers; never decrement stock in the page directly.
- Inspection submission is centralized in `dbService.submitInspection`: it creates an inspection, creates one issue and initial status log per flagged item, updates linked equipment status, and marks the vehicle `in_use` with the latest inspection fields.
- Inspection records may carry `taskId`, `scheduleLabel`, and `scheduledAt`; a completed task is not a duplicate-prevention lock because the UI intentionally permits a second inspection when a manager selects an already-completed scheduled task.
- User profile and vehicle images currently use browser data URLs or external URLs stored in their Firestore documents. This avoids requiring Firebase Storage for the current demo, but large production uploads should move to Firebase Storage rather than enlarging documents.

## Repository-specific conventions

- Prefer `dbService` methods over direct localStorage or Firestore access in pages/components. If data changes, use the service so local cache, Firestore writes, and the `sunny_db_update` event stay consistent.
- Pages that display mutable fleet data generally load it in an effect, subscribe to `sunny_db_update`, and clean up the event listener on unmount. Follow that pattern when adding a new dashboard surface.
- Use the `@/*` path alias for imports from `src`, and use the existing domain types instead of introducing duplicate page-local shapes.
- Keep browser-only code behind client components/effects. `dbService` returns fallback data during non-browser access, but its normal persistence and Firebase behavior require `window`.
- Sanitize objects with `sanitizeForFirestore` before adding/updating Firestore documents; Firestore rejects `undefined` values. Preserve the local-first fallback when Firebase is unavailable.
- Issue status changes must go through `dbService.updateIssueStatus`. It appends an `IssueStatusLog` entry and updates linked equipment; do not overwrite the history or mutate only the visible status.
- Use ISO timestamps and `dateString` values in `YYYY-MM-DD` form for inspection/issue records and date filtering. Keep display formatting in the UI.
- Vehicle lookup accepts IDs, QR tokens, vehicle numbers, `sunny://vehicle/...`, and supported inspect URL forms. Reuse `getVehicle`/`getVehicleByQR` rather than adding another parser.
- QR and dynamic vehicle links must remain compatible with the GitHub Pages SPA fallback. The app intentionally converts `/inspect/:id` to `/inspect?id=...` and `/vehicles/:id` to `/vehicles/detail?id=...`; preserve this convention when changing navigation or QR payloads.
- Use `process.env.NEXT_PUBLIC_BASE_PATH` when constructing static asset URLs (as `Sidebar` does), so logos and other public assets work both locally and under `/sunny`.
- The shared layout already provides responsive desktop navigation, a mobile drawer, and a floating mobile QR action. Route-specific UI should fit that shell rather than adding a second global header/navigation system.
- Tailwind scans `src/app`, `src/components`, and `src/pages`; use the existing `sunny-*` palette and utility-class style unless a component genuinely needs CSS in `globals.css`.
- The current workflow and `how_to_run.md` are authoritative for npm/Pages commands. There is no README, CONTRIBUTING guide, or other assistant configuration in the repository.
