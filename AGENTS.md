# AGENTS.md — Sunny Fleet Environment Guide

Repository: `sunny` (Aaron Heiner's BYU-Idaho CSE 499 Senior Project & Fleet Management System).

---

## 🧭 Navigation Pointers

- **Senior Project Milestones & Progress**: Read [`courses/cse499/NOTES.md`](courses/cse499/NOTES.md), [`courses/cse499/MISSION.md`](courses/cse499/MISSION.md), and [`README.md`](README.md).
- **Backend AWS Lambda Source**: Located in [`lambda/index.mjs`](lambda/index.mjs) (automated CI/CD deployment via [`.github/workflows/deploy-lambda.yml`](.github/workflows/deploy-lambda.yml)).
- **Domain & UI Surfaces**:
  - Vehicle Inspections: [`src/app/inspect/InspectClient.tsx`](src/app/inspect/InspectClient.tsx)
  - Timesheet & Shifts: [`src/app/timesheets/TimesheetsClient.tsx`](src/app/timesheets/TimesheetsClient.tsx)
  - Pending Findings: [`src/app/pending/page.tsx`](src/app/pending/page.tsx)
  - Checklist Settings: [`src/app/settings/page.tsx`](src/app/settings/page.tsx)
  - Training Logic: [`src/lib/training/trainingDomain.ts`](src/lib/training/trainingDomain.ts)
- **Dual-Hosting Base Path Rules**:
  - **GitHub Pages**: uses `NEXT_PUBLIC_BASE_PATH=/sunny`
  - **Vercel**: uses root `/`
  - Always verify with `node scripts/check-hosting-build.mjs` when altering routes or public asset references.

---

## 🛡️ Verification Guardrails

Always run the full suite before opening a PR or committing code:
- **Comprehensive check**: `npm run check` (runs TypeScript type-check, ESLint, and Vitest suite)
- **Unit & Integration Tests**: `npm test` (`vitest run`)
- **Hosting URL validation**: `node scripts/check-hosting-build.mjs`

---

## 🔄 Wiki Synchronization Rule

Whenever meaningful architectural, domain, or feature changes are made to Sunny Fleet:
- Automatically update the personal knowledge base at `/Users/aaronheiner/wiki`.
- Update `wiki/entities/sunny-fleet.md` with new capabilities, patterns, and component structures.
- Document any reusable technical patterns under `wiki/concepts/` (e.g. state management, offline sync, serverless patterns).
- Append an entry to `/Users/aaronheiner/wiki/log.md` detailing the changes and run `python3 scripts/lint.py` in `/Users/aaronheiner/wiki` to ensure link integrity.
