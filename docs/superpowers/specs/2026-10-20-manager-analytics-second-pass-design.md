# Manager Analytics second pass — work-mode tabs + compact cards

**Branch:** `october20-second-pass`  
**Date:** 2026-10-20  
**Status:** Approved (user: proceed with recommended options)

## Problem

Fleet overview dumps Priority actions, identity setup, tall vehicle cards, and equipment into one long scroll. Vehicle cards stack dozens of “Add identity detail” links; Priority rows overflow with repeated buttons. Hard to scan, hard to measure progress.

## Goals

1. Work-mode tabs so each screen has one job and short scroll.
2. Compact vehicle cards with drill-in for setup detail.
3. Priority rows: one primary CTA + More menu (no overflow strip).
4. Prove maintenance data persists to Firestore (mocked tests) for reporting confidence.
5. Document how to run those tests.

## Non-goals

- New maintenance domain rules or ML/BigQuery.
- Changing Sample mode’s no-live-write contract.
- Full redesign of Timeline / Equipment life tabs beyond density consistency.
- Moving layout preferences out of localStorage.

## Locked decisions

| Topic | Choice |
|-------|--------|
| IA | Work-mode tabs: Fleet overview (metrics/charts + customize layout); Priority; Vehicles; Equipment. Keep existing Maintenance timeline + Equipment life top tabs. |
| Vehicle cards | Compact: name, status, odometer, oil status, one primary CTA → existing setup/editor modal |
| Priority | One primary + More menu; dedupe repeated actions |
| Approach | Surgical restructure of `MaintenanceAnalytics` + CSS; no greenfield rewrite |

## Information architecture

**Top tabs (existing + clarified):**

- **Fleet overview** — metrics, outlook/charts, customize layout. No tall vehicle/equipment stacks.
- **Maintenance timeline** — unchanged purpose; minor density polish if needed.
- **Equipment life** — unchanged purpose.

**Fleet overview sub-nav (new):**

- **Summary** (default) — metrics + chart widgets only  
- **Priority** — weekly/pinned actions, compact rows  
- **Vehicles** — search + compact vehicle card grid  
- **Equipment** — equipment service + maintenance actions (compact)

Identity setup checklist moves into the Vehicles drill-in / setup flow (or a compact “N vehicles need identity” banner linking to Vehicles), not a full-page repeated link list.

## Card & row styling

- Clear hierarchy: title → one status chip → 2–3 metrics → one primary button.
- Setup issues: count chip (“5 setup items”) opening the existing editor; no per-field link walls on the card.
- Photo upload only in drill-in/editor, not on every summary card.
- Priority: wrap-safe row; primary = highest-urgency next step; remaining actions in menu.
- CSS: tighter section spacing, consistent `sectionHint`, no horizontal clip on action rows.

## Firebase / reporting

Maintenance data is stored on Firestore `vehicles` and `equipment` documents via `dbService` (fields such as `maintenance`, `maintenanceReadings`, `serviceHistory`, `maintenanceAppointments`, `imageUrl`, `maintenanceRules`, `operatingHours`). Sample mode does not write live fleet data. Analytics layout prefs stay in localStorage.

**Tests:** Extend/add Vitest coverage that maintenance writes call Firestore `setDoc`/`updateDoc`/`arrayUnion` paths (mocked) and that failed cloud writes do not claim success (align with `maintenancePersistence.test.ts`). Document `npm test` commands in a short note under `docs/` or an appendix in the testing guide.

## Success criteria

- Fleet overview Summary fits without scrolling through vehicle walls.
- Vehicles tab shows compact cards; drill-in still completes setup.
- Priority has no overflowing button strips.
- Persistence tests pass; owner can run `npm test` / focused file path to verify.
- Existing analytics suites and Sample-mode no-write contract stay green.

## Implementation order

1. Branch `october20-second-pass` from current `main`.
2. Sub-nav + move widgets into Summary / Priority / Vehicles / Equipment.
3. Compact vehicle card + drill-in wiring.
4. Priority primary + More menu; dedupe actions.
5. CSS density pass.
6. Persistence test hardening + how-to-run docs.
7. Verify `npm test` + analytics-focused suite.
