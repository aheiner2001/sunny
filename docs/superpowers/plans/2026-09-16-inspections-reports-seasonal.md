# Inspections date filter, Reports tables, seasonal questions (+ damage label fix)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship approved design `docs/superpowers/specs/2026-09-16-inspections-reports-seasonal-design.md` on `feat/shop-exit-return`, plus fix Vehicles damage history `Â·` mojibake.

**Architecture:** Extend `activeChecklistQuestions` + Settings question modal for seasonal MM-DD windows + `forceActive`. Add Inspections date-range presets (mirror Reports). Add TanStack Table + Recharts on Reports. Replace double-encoded `Â·` with ASCII ` · ` or ` - ` in `VehicleDamagePanel`.

**Tech stack:** Next.js 14, React 18, Vitest, local `dbService`, new deps `@tanstack/react-table` + `recharts`. Working copy: `C:\Sandbox\sunny` on user machine (do not clone elsewhere).

**Repo:** https://github.com/aheiner2001/sunny · branch `feat/shop-exit-return`

---

## File map

| File | Role |
|------|------|
| `package.json` | add `@tanstack/react-table`, `recharts` |
| `src/types/index.ts` | seasonal fields on `ChecklistQuestion` |
| `src/lib/checklistQuestions.ts` | active rule + NYE wrap + forceActive |
| `src/lib/checklistQuestions.test.ts` | tests |
| `src/app/settings/page.tsx` | Always / Temporary / Seasonal UI |
| `src/app/inspections/page.tsx` | date presets + custom range |
| `src/app/reports/page.tsx` | tables + charts |
| `src/components/VehicleDamagePanel.tsx` | fix `Â·` → ` · ` or `-` |

---

### Task 1: Fix damage history mojibake

**Files:** `src/components/VehicleDamagePanel.tsx`

- [ ] Replace every double-encoded separator (`Â·` / bytes `c3 82 c2 b7`) with ` · ` (U+00B7 once) or ASCII ` - `
- [ ] Places: History title suffix, userName line, SideTile `logged` suffix
- [ ] Commit: `fix: damage history labels use plain separators (no Â)`

### Task 2: Seasonal question model + helper + tests (TDD)

**Files:** types, `checklistQuestions.ts`, test

- [ ] Add `isSeasonal?`, `seasonStart?`, `seasonEnd?` (`MM-DD`), `forceActive?`
- [ ] Write failing tests: in window, out of window, Dec–Feb wrap, forceActive, temporary unchanged
- [ ] Implement `isDateInSeason(mmddStart, mmddEnd, today)` + update `activeChecklistQuestions`
- [ ] Commit: `feat: seasonal checklist windows (yearly MM-DD + force on)`

### Task 3: Settings UI for seasonal

**Files:** `src/app/settings/page.tsx`

- [ ] Segment Always | Temporary | Seasonal in add/edit modal
- [ ] Seasonal: two `type="date"` month-day or `MM-DD` inputs; Force on now switch
- [ ] Badge on list rows; clear opposing fields on save
- [ ] Commit: `feat: Settings UI for seasonal questions`

### Task 4: Inspections date filter

**Files:** `src/app/inspections/page.tsx`

- [ ] Presets: all, today, 7d, 30d, this_month, last_month, this_year, custom
- [ ] Custom: start/end date inputs; filter on `dateString`
- [ ] Keep existing sort
- [ ] Commit: `feat: Inspections date range presets and custom range`

### Task 5: Install packages + Reports tables/charts

- [ ] `npm install @tanstack/react-table recharts`
- [ ] Refactor Reports for 1–2 Recharts + TanStack tables bound to existing date preset
- [ ] Keep CSV exports
- [ ] Commit: `feat: Reports tables (TanStack) and Recharts charts`

### Task 6: Verify

- [ ] `npx tsc --noEmit` and `npm test` (checklist + relevant)
- [ ] Push `feat/shop-exit-return`

---

## Seasonal active rule (reference)

```
if seasonal:
  if forceActive -> show
  else if today MM-DD in [start, end] inclusive (wrap if start > end) -> show
  else hide
```