# Shop-exit return checklist & overnight catch-up

**Date:** 2026-09-15  
**Repo:** aheiner2001/sunny  
**Status:** Approved for planning (Approach A)  
**Branch target:** feature branch off `main` (not `styling-changes`; that work is already merged)

## Problem

Drivers check out vans by completing the morning (pre-trip) inspection. Managers want Vehicles / Dashboard to show who is out. Returning to the shop should be a deliberate, quick post-trip step via a **single shop-door QR**, not another van-sticker scan. If someone forgets, the van must not stay In use forever: overnight clear to Available, and the next passcode login should offer a short catch-up return form.

## Goals

- One printable **shop-exit** QR that opens a short, **manager-editable** return checklist for the signed-in driver’s current van, then clears occupancy.
- Overnight (next local calendar day): auto-clear In use → Available; record a **missed return** when the shift ended without a return submission.
- Morning passcode login: if the user has a pending missed return, prompt them to complete that short checklist.
- Keep existing pre-trip scan → inspect → checkout, takeover prompts, and manager Return to shop / Change driver.

## Non-goals (this spec)

- Separate per-bay exit QRs.
- Requiring a second van-sticker scan on every return (only as an optional fallback).
- Blocking the fleet overnight until checklists are filed (occupancy still clears).
- Manager “Missed returns” dashboard widget (optional follow-up).
- Firebase Storage for photos (keep compressed data URLs).

## Current baseline (already on main)

- Inspection submit checks out the van when free (`occupancyAfterInspection`); does not steal another driver.
- Vehicles shows Available / In use and Current Driver.
- Overnight reconcile on first `getVehicles()` of the local day using `currentUserStartAt` or `lastInspectionAt`.
- Same-driver inspect offers Return to shop; other drivers get Take over.
- Photo answer type and manager-editable morning checklist in Settings.

## Day in the life

1. **Leave:** Passcode → scan van QR → pre-trip checklist → submit → van In use, driver named.
2. **Return:** Scan shop-exit QR → `/return` → short return checklist for their van → submit → return record saved, van Available.
3. **Ambiguous identity:** No checkout for this user → show In use list (and optional scan sticker).
4. **Overnight:** Still-checked-out vans clear to Available; create missed-return `{ userId, vehicleId, dateString, status: 'pending' }` for that shift’s driver when no return was filed.
5. **Next login:** Passcode success → if pending missed return → catch-up UI (same short form, “from yesterday”) → submit marks missed return done.
6. **Managers:** Dashboard Return to shop / Change driver unchanged. Force-return does **not** create a missed-return nag (only overnight auto-clear does).

## Data model

### Checklist config

Extend `ChecklistConfig` (or equivalent settings doc) with:

- `returnQuestions: ChecklistQuestion[]` (same shape/types as morning questions)
- Optional `returnCategories` if categories are required by the shared editor; otherwise a flat list is enough

Seed a small default set (e.g. body/damage check, fuel/supplies, anything to report). Managers edit under Settings → **Return checklist** beside morning questions.

### Return submissions

Store as inspection-like records with `kind: 'return'` (preferred: same `inspections` collection / local list with a discriminant) so:

- Vehicle timeline can show pre-trip vs return
- Main Inspections list can filter or badge by kind without a second persistence stack

Submitting a return:

1. Persist the return record (responses, notes, photos as data URLs)
2. `checkInVehicle` (clear `currentUser*`, status Available unless maintenance)

### Missed returns

New localStorage key + Firestore collection (or settings subdoc), e.g. `missedReturns`:

```
{
  id: string
  userId: string
  userName: string
  vehicleId: string
  vehicleNumber: string
  dateString: string        // local day of the shift that was cleared
  status: 'pending' | 'done'
  createdAt: string         // ISO, when overnight clear ran
  completedAt?: string | null
  completedReturnInspectionId?: string | null
}
```

Created only by overnight auto-clear when that driver had no `kind: 'return'` for that van covering the shift. Completing catch-up sets `done` and links the return inspection id.

### Shop-exit QR

Stable URL: `{basePath}/return` (respect Next `basePath` `/sunny`). One printable badge in Settings (reuse `QRCodeSVG` / print patterns from vehicle QR). Not per-vehicle.

## UI

| Surface | Behavior |
| --- | --- |
| `/return` | Resolve van → short checklist → success “Returned · Van #X available.” |
| Settings | Return checklist editor + Print shop-exit QR |
| Passcode success | If pending missed return for user → intercept to catch-up `/return` (preselected van, yesterday label) |
| Vehicles / Dashboard | No redesign; stay accurate via overnight clear |

## Resolution rules for `/return`

1. If signed-in user has exactly one van with `currentUserId === user.id` → use it.
2. Else show In use vans; optional “scan sticker.”
3. Catch-up mode: van comes from the missed-return row (even if van is already Available).

## Error handling & edge cases

- Already Available + no missed return → empty state + In use picker.
- Mid-day takeover → live checkout belongs to the new driver; overnight missed-return, if any, belongs to whoever was cleared overnight.
- Offline: queue return like offline pre-trip; clear local occupancy when submitting return; sync when online.
- Manager force-return: clear van; **do not** create missed-return.
- Overnight without ISO checkout timestamp: keep existing fallback (`lastInspectionAt` day); still attempt missed-return for `currentUserId` when clearing.

## Testing

- Unit: overnight clear creates missed-return only when no return exists; return submit clears occupancy; resolution prefers signed-in van.
- Unit: checklist config loads/saves `returnQuestions` independently of morning questions.
- Integration / manual: print `/return` QR; passcode catch-up after simulated next-day clear; takeover then overnight.

## Implementation notes

- Build on `src/lib/occupancy.ts` and existing `checkInVehicle` / `checkOutVehicle`.
- Prefer extending `InspectClient` patterns or a thin `ReturnClient` that reuses question widgets and `canSubmitInspection`.
- Wire passcode success in `PasscodeGate` / AuthContext after session write — do not block managers forever; allow “complete now” as the primary path (catch-up required for employees with pending items; managers may dismiss — **employee pending is blocking until done or explicitly deferred once per session**).  

Clarifying product rule locked here: **employees with a pending missed return must complete or explicitly choose “Remind me later” once per session; managers can dismiss.** Overnight occupancy clear always happens regardless.

## Success criteria

- Shop-exit QR in hand prints and opens the short return form for the logged-in driver’s van.
- Managers can edit return questions without touching the morning list.
- After midnight (local), vans are not left In use from yesterday.
- Next passcode login surfaces yesterday’s forgotten return when owed.
