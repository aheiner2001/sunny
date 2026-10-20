# Timesheet extra fixes — punch feedback, table view, CSV

**Branch:** `october20-extra-fixes`  
**Date:** 2026-10-20  
**Status:** Approved (user: recommended path C; preview on this branch)

## Problem

In preview, Clock In can feel like a no-op (no busy state / weak feedback). Manager “submit” (missing hours) is easy to confuse with a real punch. Managers need a clean table scan and CSV export for the selected week.

## Goals

1. Obvious punch feedback: busy, success, already-active, and humanized errors next to the controls.
2. Stop server snapshots from wiping in-flight / pending local timesheet maps incorrectly.
3. Manager + employee: **View in table** (readable grid) and **Export CSV** for the filtered week.

## Non-goals

- Changing approval rules or self-approval.
- Payroll integrations beyond CSV download.
- Redesigning the whole timesheet page.

## Design

- `humanizeTimesheetError` for auth / permission / NO_ACTIVE_SHIFT / generic failures.
- Punch buttons disable while saving; `aria-live` status under the punch card.
- Snapshot `receiveMap`: only `map.clear()` on server snapshots that are not still applying pending writes.
- CSV columns: Employee, Date, Start, End, Break (min), Net hours, Status, Source, Shift ID.
- Table modal uses the same filtered week rows as the current view (team filters apply on Manager Review).
