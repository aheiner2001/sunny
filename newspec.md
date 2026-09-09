# Design Spec: Equipment Lifespan Tracking

**Date:** 2026-09-09  
**Status:** Draft — awaiting user review  
**App:** Sunny Fleet (vehicle & equipment accountability)  
**Approach:** Extend existing `Equipment` records (Approach 1)

---

## 1. Goal

Give managers a quiet way to know when tools and equipment on vans are due for inspect/replace — without cluttering the detailer’s inspection checklist.

Detailers log how many cars they clean on a van during the day. That usage wears down **usage-based** tools (e.g. brushes). **Time-based** gear (e.g. air compressor hose reel) soft-flags when a calendar lifespan expires. Managers review flags, extend life, mark replaced, or retire tools.

---

## 2. Decisions (locked)

| Topic | Choice |
|--------|--------|
| Tool identity | One physical tool = one Equipment record with its own QR and life |
| Job entry | Anytime on the vehicle screen; editable during the day |
| Alerts | Soft manager “due for review” flags only — no auto-created issues |
| Job wear applies to | Usage-mode lifespan tools assigned to that van only |
| Life mode | Mutually exclusive: **usage (cars)** *or* **time (months)** — not both |
| Employee visibility | Light only: OK / Getting low / Due for check (no manager actions) |
| Manager actions | Extend · Replaced (reset) · Retire |
| Build approach | Extend existing Equipment + van daily job count |

---

## 3. Architecture

### 3.1 Core model

- **One physical tool = one `Equipment` document**, typically quantity 1, with a unique QR token (fits planned QR stickers).
- Lifespan is optional metadata on that equipment item.
- **Vehicle daily job log:** per vehicle, per calendar day, a mutable `jobsToday` count.
- When `jobsToday` changes by `delta`, every **active, usage-mode, lifespan-tracked** tool currently assigned to that vehicle gets `carsUsed += delta` (clamped ≥ 0).
- Time-mode tools ignore job counts; they soft-flag when `today ≥ dueDate`.

### 3.2 Soft flags (not issues)

When remaining life hits zero (usage) or due date passes (time), status becomes `due_for_review`. This feeds a **manager Due for review** list. It does **not** create records in the existing `issues` collection and does **not** appear on the inspection/detail checklist flow.

### 3.3 Roles

| Actor | Can do |
|--------|--------|
| Employee | Edit van jobs today; scan/assign tools as today; see quiet life status chips |
| Manager | Configure lifespan on create/edit; view Due for review; Extend / Replaced / Retire |

---

## 4. Data model

### 4.1 Extensions on `Equipment`

Add optional lifespan fields (names illustrative; implement to match existing TypeScript style):

| Field | Type | Notes |
|--------|------|--------|
| `lifespanEnabled` | boolean | Default false — tool behaves like today |
| `lifespanMode` | `'usage' \| 'time'` | Required when enabled; mutually exclusive |
| `expectedCars` | number \| null | Usage mode: e.g. 300 |
| `carsUsed` | number | Usage mode: cumulative cars worn; default 0 |
| `expectedMonths` | number \| null | Time mode: e.g. 24 |
| `lifeStartedAt` | ISO date string \| null | Time mode: start of life clock |
| `dueDate` | ISO date string \| null | Time mode: derived or stored from start + months |
| `lifespanStatus` | `'ok' \| 'getting_low' \| 'due_for_review'` | Derived and/or cached for queries |
| `retiredAt` | ISO string \| null | Set when retired; excluded from wear and due lists |

**Quantity guidance:** Lifespan-tracked tools should be individual assets (qty 1 per QR). Shared bulk consumables without per-unit QR stay `lifespanEnabled: false`.

### 4.2 Vehicle daily job log

New collection or keyed store (e.g. `vehicle_day_logs` / local+Firebase equivalent):

| Field | Type | Notes |
|--------|------|--------|
| `id` | string | e.g. `{vehicleId}_{YYYY-MM-DD}` |
| `vehicleId` | string | |
| `dateString` | string | `YYYY-MM-DD` |
| `jobsCount` | number | ≥ 0 |
| `updatedAt` | ISO string | |
| `updatedById` | string | |
| `updatedByName` | string | |

### 4.3 Thresholds (defaults)

| Status | Usage mode | Time mode |
|--------|------------|-----------|
| OK | Remaining > 20% of `expectedCars` | More than 30 days before `dueDate` |
| Getting low | Remaining ≤ 20% and > 0 | Within 30 days of `dueDate` (not past) |
| Due for review | `carsUsed ≥ expectedCars` (remaining ≤ 0) | `today ≥ dueDate` |

Remaining (usage) = `max(0, expectedCars - carsUsed)`.

---

## 5. UI surfaces

### 5.1 Manager — Equipment create/edit

- Toggle: **Track lifespan**
- If on → choose **Usage (cars)** or **Time (months)**
- Usage: expected cars (required positive integer)
- Time: expected months (required) + life start date (default today)
- Existing QR print/display unchanged (one sticker per tool)

### 5.2 Employee — Vehicle detail

- **Jobs today** control (stepper or number input), editable anytime that day
- Assigned tools: quiet status chip only — `OK` / `Getting low` / `Due for check`
- No extend / replace / retire controls
- No blocking alerts on checklist/inspect flows

### 5.3 Manager — Due for review

- Dashboard card and/or filter on Equipment (or adjacent manager page)
- Lists tools with `lifespanStatus === 'due_for_review'` (and optionally getting_low as a secondary filter)
- Actions per tool:
  - **Extend** — add N cars to expected (usage) or add N months to due date (time); recalculate status
  - **Replaced** — reset `carsUsed` to 0 (usage) or set `lifeStartedAt` / `dueDate` to a fresh cycle (time); clear due flag
  - **Retire** — set `retiredAt`; remove from active assignment wear and due lists

---

## 6. Data flow & rules

### 6.1 Job count change (same calendar day)

1. Employee changes jobs today from `N` → `M`
2. `delta = M - N`
3. Persist new `jobsCount` for that vehicle + date
4. For each tool where all are true:
   - assigned to this vehicle
   - `lifespanEnabled`
   - `lifespanMode === 'usage'`
   - not retired
5. Apply `carsUsed = max(0, carsUsed + delta)`
6. Recompute `lifespanStatus`

### 6.2 Day rollover

- New calendar day → `jobsCount` starts at **0** for that day
- Yesterday’s wear already stored in each tool’s `carsUsed` — do **not** re-apply

### 6.3 Tool moves between vans

- Wear applies only to tools assigned to the van **at the moment** its job count changes
- Moving a tool does not rewrite historical job logs or past wear

### 6.4 Time-mode evaluation

- On app load / equipment list fetch / due-list open: if `today ≥ dueDate` → `due_for_review`; else if within 30 days → `getting_low`; else `ok`
- Job count changes never modify time-mode tools

### 6.5 Manager actions

| Action | Usage | Time |
|--------|--------|------|
| Extend | Increase `expectedCars` by N | Push `dueDate` forward by N months |
| Replaced | `carsUsed = 0`; recompute status | New `lifeStartedAt` = today; recompute `dueDate` from `expectedMonths` |
| Retire | Set `retiredAt`; exclude from wear + due lists | Same |

After Extend/Replaced, clear `due_for_review` if thresholds no longer met.

---

## 7. Edge cases & errors

- `jobsCount` cannot go below 0; soft upper cap (e.g. 50) with confirm if exceeded
- If delta would drive `carsUsed` below 0, clamp at 0
- Unassigned, retired, lifespan-off, and time-mode tools never take job wear
- Concurrent editors on same van job count: last write wins; delta applied from the value each client loaded (known v1 limitation)
- Failed save: toast error; do not partially apply wear; keep previous persisted values
- Create/edit validation: lifespan on requires mode + positive expected cars or months

---

## 8. Out of scope (v1)

- Auto-creating maintenance `issues`
- Hybrid cars + calendar on one tool
- Per-job attribution (“which brush touched which car”)
- Push / email / SMS notifications (in-app due list only)
- ML predictive failure models
- Changing bulk multi-qty inventory into lifespan assets automatically (manager creates individual QR’d tools)

---

## 9. Testing

- Delta wear: 0→3 subtracts 3 from usage tools on that van; 3→2 restores 1
- Only usage-mode, assigned, non-retired tools wear
- Day rollover does not re-apply yesterday’s jobs
- Thresholds: OK → getting_low → due_for_review
- Time-mode flags by date; ignores job count
- Extend / Replaced / Retire update status and exclude retired from wear
- Employees cannot perform manager lifespan actions; managers can
- Failed persist leaves life and job count unchanged

---

## 10. Success criteria

- Manager can create a brush (usage, 300 cars) and a hose reel (time, 24 months), each with QR
- Detailer edits jobs today on a van; brush life drops; hose reel does not
- When brush hits 300 (or hose due date passes), item appears on manager Due for review — not on inspect checklist
- Manager can extend, mark replaced, or retire
- Employees see only light status chips

---

## 11. Relationship to existing Sunny features

| Existing | Relationship |
|----------|----------------|
| Vehicle QR / claim | Unchanged; job count lives on vehicle detail after claim/use |
| Equipment QR scan & assignment | Required path for “tool is on this van” before usage wear applies |
| Inspections / checklist | Unchanged; no lifespan prompts on detail line |
| Issues tracker | Unchanged; lifespan flags stay separate in v1 |
| Equipment inventory / shop stock | Lifespan tools preferred as individual qty-1 assets |

---

## 12. Open implementation notes (non-blocking)

- Persist via existing `dbService` patterns (local/Firebase as currently structured)
- Prefer deriving `lifespanStatus` in one shared helper used by UI and wear updates
- “Getting low” thresholds (20% / 30 days) can be constants in v1; settings later if needed
