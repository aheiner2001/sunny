# Sunny Fleet — Tag equipment family on checklist questions

**Date:** 2026-09-17  
**Branch target:** feature work off `main` as decided at plan time  
**Status:** Design approved in brainstorm; ready for implementation plan

## Goal

Managers tag checklist questions with an equipment **family** (e.g. Air Compressor). The shared checklist never stores a specific unit id. When an inspector flags that question on a van, the app resolves the family to the correct unit(s) on that van so the resulting issue (and equipment flag path) points at the right inventory item.

## Non-goals

- Assigning a concrete `equipmentId` on the question in Settings.
- Changing how equipment is assigned to vans in inventory.
- Firebase Storage or new collections for tags.
- Redesigning the whole inspect UI beyond the unit-picker when needed.

## Context

- Questions already have optional `equipmentFamily` and free-text `equipmentName`.
- `equipment_check` / `equipment_status` already show an Equipment Family select in Settings.
- `resolveVehicleEquipmentForFamily` in `checklistPairing.ts` resolves family → one unit on a van (first match).
- Inspect builds issues with `equipmentId` / `equipmentName` when linkage exists; free-text “Associated Equipment Name” does not reliably drive van-specific ids.

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| What Settings stores | Family label/key only (`equipmentFamily`) |
| Shared checklist | Same questions for all vans; no per-van question templates |
| When resolution runs | At inspect/return answer/submit time for the current van |
| One match on van | Auto-attach that unit’s id + name to the issue |
| Zero matches | Still create issue; no `equipmentId`; soft warning |
| Two+ matches | Inspector must pick a unit before submit |
| Free-text Associated Equipment Name | Replace with Tag equipment family picker; legacy `equipmentName` may remain as resolve fallback |

## Approaches considered

1. **Extend `equipmentFamily` + resolve at inspect** — one family picker; reuse pairing helpers. **Chosen.**
2. Separate `taggedEquipmentFamily` field — more dual paths.
3. Tag a concrete unit at Settings time — breaks shared checklist.

## Architecture

### Data

- Question template: `equipmentFamily?: string` (family label as today).
- Do **not** set `equipmentId` on the checklist question for this feature.
- Inspection response / issue at submit: `equipmentId` + `equipmentName` when resolved or chosen.

### Settings

- Label: **Tag equipment** (optional).
- Control: `<select>` of distinct families from `listDistinctEquipmentFamilies(dbService.getEquipment())`.
- For `equipment_check` / `equipment_status`, show a single family control (no duplicate Tag + Family fields).
- Question list chip: `Tagged: {family}` when set.

### Inspect / return

When a question is flagged and has a family tag (or equipment_check path):

1. `listVehicleEquipmentForFamily(equipment, vehicleId, family)` → candidates (active, on van, not retired).
2. Length 1 → use that unit automatically.
3. Length 0 → create issue without id; soft inline warning.
4. Length ≥ 2 → show required unit picker; block submit until chosen; attach chosen unit to issue payload.

Extend `buildEquipmentFlagPayload` / inspect issue creation so **any** flagged question with `equipmentFamily` can link (not only `equipment_check` / `equipment_status`), using the same resolve/pick rules.

### Helpers (`checklistPairing.ts`)

- Add `listVehicleEquipmentForFamily(...)` returning `Equipment[]`.
- Keep `resolveVehicleEquipmentForFamily` as “exactly one preferred match” or implement as first of list for backward compatibility; call sites that need multi-match use the list helper.
- Tests: 0 / 1 / 2+ on van; Settings persists family without id.

### Errors / edge cases

- Soft warning copy example: “No {family} assigned to this van — issue will not link to a specific unit.”
- Multi-match: “Select which {family} this flag applies to.”
- Retired units excluded from candidates.

## Testing

- Unit: list/resolve 0, 1, 2+; flag payload includes id when one match; null id path when zero.
- Manual: tag Air Compressor in Settings → inspect on a van with that tool → issue shows exact unit; van with two → picker; van with none → warning + issue without id.

## Success criteria

- Managers tag families only; checklist stays van-agnostic.
- Flagged answers attach the correct van unit when unambiguous.
- Ambiguous vans require a pick; empty vans still allow issue creation with a clear warning.

## Rollout

1. Helpers + tests.  
2. Settings Tag equipment UI.  
3. Inspect/return resolve + multi-pick + issue wiring.  
4. Manual pass.
