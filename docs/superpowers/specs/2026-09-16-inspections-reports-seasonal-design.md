# Design: Inspections date filter, Reports tables, seasonal questions

**Date:** 2026-09-16  
**Branch:** `feat/shop-exit-return`  
**Status:** Pending user review  

## Goals

1. **Inspections list** — managers can narrow by date (presets + custom range), not only sort newest/oldest.
2. **Reports** — clean tabular views (TanStack Table) plus a few Recharts charts; keep existing CSV/HTML exports.
3. **Checklist questions** — add **seasonal** visibility: yearly `MM-DD`→`MM-DD` window, plus a **Force on now** toggle for early weather (e.g. early snow). Keep existing temporary (blitz until date) and always-on.

Out of scope for this pass: AG Grid / full in-app spreadsheet, Apache ECharts, rewriting payroll/timesheets, new standalone analytics product.

---

## 1. Inspections date filter

### Current

- Sort: `date_desc` | `date_asc` | status | vehicle | driver
- Filters: search, kind (pretrip/return), status, vehicle
- No date *range* filter

### Design

Add `datePreset` state alongside existing filters:

| Preset | Meaning |
|--------|---------|
| `all` | No date bound (default stays current behavior for “see everything”) |
| `today` | `dateString === today` |
| `7d` | Last 7 days inclusive |
| `30d` | Last 30 days |
| `this_month` | Calendar month start → today |
| `last_month` | Previous calendar month |
| `this_year` | Jan 1 → today |
| `custom` | Inclusive `customStart`–`customEnd` (`YYYY-MM-DD`) |

UI (same card strip as Vehicles/Equipment):

- Chip row for presets
- When `custom`: two native `<input type="date">` (start/end). Validate start ≤ end; empty end treated as today.
- Keep the existing **Sort** select unchanged (filter then sort).

Filter on `insp.dateString` (fleet local day key) for consistency with Reports/Calendar.

Empty state copy: mention date range if filters yield zero rows.

---

## 2. Reports: tables + light charts

### Packages (new)

```bash
npm install @tanstack/react-table recharts
```

### Tables

Replace dense ad-hoc metric dumps with 2–3 clean tables driven by TanStack Table:

1. **Inspections summary** — date, van, driver, kind, status, flagged count  
2. **Issues** — opened, van, status, age / resolved lag when resolved  
3. Optional third: **Question blitz / seasonal** — question text, responses in range, flag rate (if data allows without heavy refactor)

Features: column sort, simple text filter on the table, sticky header, reuse existing date preset on the page so tables respect the same range. Keep **Download CSV** actions.

### Charts (minimal)

Recharts only:

- Line or bar: inspections (or pass rate) over time in selected range  
- Bar: open vs resolved issues (or issues opened per week)

No Chart.js / ECharts this pass.

### Trim / de-emphasize

Do not invest in decorative “14-day week view” widgets if they don’t answer a manager question. Prefer date filter + table + 1–2 charts. Issue volume + resolution speed **is** worth a row/metric **if** issues get closed in-app; otherwise show volume only.

---

## 3. Seasonal checklist questions

### Model (`ChecklistQuestion`)

Keep:

- `isTemporary?: boolean`
- `expiresAt?: string | null` — `YYYY-MM-DD`, blitz ends after this day

Add:

- `isSeasonal?: boolean`
- `seasonStart?: string | null` — `MM-DD` (e.g. `12-01`)
- `seasonEnd?: string | null` — `MM-DD` (e.g. `02-28`)
- `forceActive?: boolean` — manager toggle; when true, question is active even outside the window

**Mutual exclusivity in UI:** question is one of Always | Temporary | Seasonal (radio/segment). Saving seasonal clears temporary fields and vice versa.

### Active rule (`activeChecklistQuestions`)

A question is shown on inspect/return if:

1. Not seasonal and not temporary → always  
2. Temporary → `expiresAt >= today` (or missing expiry → treat as active; existing behavior)  
3. Seasonal → `forceActive === true` **OR** today (MM-DD) falls inside `[seasonStart, seasonEnd]` inclusive, **including wrap** across New Year (e.g. `12-01`→`02-28`)

Yearly comparison uses month-day only; year is ignored.

### Settings UI

In add/edit question modal:

- Segmented: **Always on · Temporary blitz · Seasonal**
- Temporary: existing expiry date  
- Seasonal: Start (MM-DD), End (MM-DD), checkbox/switch **Force on now** with short hint (“Turn on early for unusual weather”)  
- List row badge: `Seasonal · Dec 1–Feb 28` or `Forced on` / `Temporary · until …`

### Persistence

Answers still snapshot onto `Inspection.responses` (`questionText`, etc.). Expiry / out-of-season only hides from **new** checklists; history unchanged.

### Tests

Extend `checklistQuestions.test.ts` for:

- In-window, out-of-window, NYE wrap, `forceActive`, temporary still works, always-on unchanged

---

## 4. What else is good to record (product note)

**Useful:** pass/flag by question (esp. seasonal + temporary), inspections per van/driver, equipment due-for-review, missed returns, issue open→resolve lag.  
**Defer:** heavy calendar heatmaps, spreadsheet-in-browser, metrics nobody closes the loop on.

---

## Success criteria

- [ ] Inspections: presets + custom date range filter list correctly; sort still works  
- [ ] Reports: TanStack tables respect page date range; CSV still works; 1–2 Recharts charts render  
- [ ] Seasonal questions: yearly MM-DD + force toggle; active helper + tests green  
- [ ] Settings modal clean and consistent with existing temporary UX  
- [ ] `tsc` / vitest relevant suites pass  

## Non-goals

Installing AG Grid, Univer, Chart.js, or ECharts; changing Firebase schema beyond local typed fields already used by `dbService` question arrays.