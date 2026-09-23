# Manager quick vehicle assignment

Date: 2026-09-23

## Goal

A manager can open a vehicle, assign an active employee, or switch the employee to it without filling out an inspection. The manager may enter the actual start time when recording an assignment late. Current occupancy and a durable timeline show who used each van and when. An inspection is optional and retains its own author.

## Current behavior

`Vehicle` stores only its current user and checkout time. `dbService.checkOutVehicle` and `checkInVehicle` change current occupancy. The scan flow already permits an employee to take over without an inspection; submitting an inspection can check out a free vehicle. Overnight reconciliation clears stale occupancy. The vehicle timeline currently contains inspections and issues, so past occupants cannot reliably be reconstructed.

## Design

Add an **Assign / Switch employee** manager action beside the current occupant on the vehicle detail page, with an active-employee selector and start time defaulting to now. An optional manager **Release van** action ends the current assignment. No checklist is opened or inspection created by these actions. The roster and detail page display the updated occupant immediately. If an employee is currently on another van, assigning them here ends that assignment at the same effective time; assigning to an occupied van ends its previous occupant's assignment. The manager sees the affected van and occupant before confirming the switch.

Persist an assignment interval with a stable ID, vehicle and employee IDs plus display-name snapshots, `startedAt`, nullable `endedAt`, source (`manager`, `employee`, `inspection`, `overnight`), and the actual actor and record time. A backdated manager start time is the effective assignment start; `recordedAt` preserves when the manager made the change. End times must not precede start times. Reject backdating that would overlap a later recorded interval; show a clear message instead of silently rewriting history. Display intervals in the vehicle timeline with start/end and the actor who recorded them. Keep the `Vehicle.currentUser*` fields as a current-state projection for the existing UI.

Route checkout, takeover, check-in, return-all, inspection-triggered checkout, and overnight auto-return through one assignment transition service, so these paths update history and current occupancy together. During migration, existing occupied vans get an initial interval using their known checkout time; historical occupants cannot be reconstructed from old inspection records. On first load and on Firestore synchronization, avoid duplicate migration intervals. Existing missed-return records remain separate and only result from the existing overnight rule.

Manager-filled inspections are a separate optional action. Where an inspection is submitted on behalf of an employee, retain the assigned employee as subject and record the manager as submitter in separate fields; show both in inspection detail and vehicle timeline. Ordinary employee inspections show the same person for both roles. An inspection must not silently transfer occupancy to its submitter. Existing records with no submitter field display their current `userName` for both roles.

## Persistence and permissions

Use the existing local cache plus Firestore synchronization pattern for a dedicated `vehicleAssignments` collection and cache key. Authorization for assignment, release, backdating, and submitting on behalf of another employee must be checked in the action/service, in addition to hiding controls from non-managers. The existing client-only role model is not a secure server-side authorization boundary; this feature must follow current app constraints and should not be represented as server-enforced permission.

## Verification

Test free-van assignment, occupied-van replacement, moving an employee from another van, release, backdated start, overlap rejection, existing scan takeover, inspection checkout, overnight clearing, migration idempotence, and both actor/subject attribution paths. Verify the roster and vehicle timeline reflect the saved intervals and that manager assignment creates no inspection.
