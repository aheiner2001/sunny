# Sunny Fleet — Damage region markers on Maverick diagrams

**Date:** 2026-09-17  
**Branch target:** feature work off `main` (or short-lived feature branch) as decided at plan time  
**Status:** Design approved in brainstorm; ready for implementation plan

## Goal

Let drivers pin damage to a specific spot on the vehicle diagram when recording on return/checkout, and let managers see those pins as red boxes on the vehicle Damage overview—tap a box to focus the matching history entry.

Also recrop the front Maverick diagram so it is not oddly clipped on the left.

## Non-goals (phase 1)

- Adding or editing damage regions from the vehicle Damage overview (phase 2).
- Multiple regions per single damage event.
- Firebase Storage migration (photos stay compressed data URLs).
- 3D / interactive car models; keep existing Maverick PNG sides.
- Changing the “No new damage” path beyond leaving region unused.

## Context (current product)

- Return flow uses `VehicleDamageCapture`: side (front | rear | left | right | cab) or “No new damage”, multi-photo data URLs, optional note.
- Vehicle detail **Damage** tab uses `VehicleDamagePanel`: side chips, Maverick diagram via `SIDE_IMAGE` / `OVERVIEW_IMAGE` (`asset()`-prefixed), history list.
- `VehicleDamageEvent` has `side`, `noNewDamage`, `photoDataUrls`, note, user, `createdAt` — no spatial data.
- Diagrams live under `public/vehicle-damage/maverick/`; URLs must use `asset()` for GitHub Pages `/sunny` basePath.

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Where to draw | Return/checkout capture (phase 1); overview is view + select |
| Where to view | Damage tab: all historical boxes for the selected side |
| Boxes per event | Exactly one region per damage event |
| Region required? | Yes, when reporting damage (not for “No new damage”) |
| Coordinate space | Normalized 0–1 relative to the side diagram (`x`, `y`, `w`, `h`) |
| Overview (all sides) | Top-down diagram without region boxes; boxes only on per-side views |
| Front art | Recrop `front.png` in the same deliverable |
| Legacy events | History still lists them; no box if `region` missing |

## Approaches considered

1. **Normalized rectangle overlay on the existing `<img>`** — store 0–1 rects; shared draw/display component. **Chosen.**
2. Canvas drawing layer — more control, heavier, harder with responsive layout.
3. Preset hotspot zones — faster tap UX, less precise, needs zone maps per side.

## Architecture

### Data

```ts
type DamageRegion = {
  x: number; // left, 0–1
  y: number; // top, 0–1
  w: number; // width, 0–1
  h: number; // height, 0–1
};

interface VehicleDamageEvent {
  // ...existing fields
  region?: DamageRegion; // required when !noNewDamage (phase 1 writes always set it)
}
```

- Clamp and normalize on write so `x,y ≥ 0`, `w,h > 0`, and `x+w ≤ 1`, `y+h ≤ 1`.
- Reject regions below a minimum size (about 2% of image width/height) so accidental taps do not save tiny boxes.
- `assertDamagePayload` / `addVehicleDamageEvent` require `region` when `noNewDamage` is false (in addition to side + ≥1 photo).

### Components

| Unit | Responsibility |
| --- | --- |
| `DamageRegionOverlay` | Renders side image + overlay; **draw** mode (pointer drag one rect, redraw replaces) or **display** mode (all regions, selectable). Uses `asset()` image paths. |
| `VehicleDamageCapture` | Side picker → overlay in draw mode → photos/note → save with region. |
| `VehicleDamagePanel` | Per-side: overlay in display mode with all events that have `region` for that side; selecting a region focuses/highlights the matching history row. |
| `vehicleDamage` helpers | Validation, clamp/min-size, optional “events with region for side” helper. |
| `dbService` | Persist `region` on create; Firestore sync same as other damage fields when configured. |

### Data flow

1. Driver selects side → draws region → attaches photo(s) → `addVehicleDamageEvent({ …, region })`.
2. Panel loads events for vehicle → filters by selected side → maps events with `region` onto overlay.
3. Tap region → set `selectedEventId` → history entry highlighted / scrolled into view.

### Error handling

- Inline errors for missing side, region, or photos (same tone as current capture).
- Too-small drag: ignore or show brief hint; do not keep invalid rect.
- Touch: use pointer events so mobile drag works.
- Missing image / basePath: continue using `asset()` (already fixed for live).

### Front art

- Recrop `public/vehicle-damage/maverick/front.png` so the vehicle is balanced in frame (left side not oddly cut).
- Do not rename path; `SIDE_IMAGE.front` stays the same.

## Phase 2 (out of scope now, noted for later)

- Create damage (draw box + photo) from the Damage overview tab.
- Optional edit/delete of a saved region.

## Testing

- Unit: region required on damage; clamp; min size; no region required for `noNewDamage`; legacy events without region still list in history helpers as appropriate.
- Manual: return draw → box on Damage tab for that side → tap focuses entry; front PNG looks correct locally and on Pages after deploy.

## Success criteria

- Damage reports from return always include one normalized region (except “No new damage”).
- Damage tab side view shows all historical red boxes for that side; tap links to the entry.
- Front diagram crop looks intentional.
- Works under `/sunny` basePath and local dev.

## Rollout

1. Types + validation helpers + db write path.
2. `DamageRegionOverlay` + capture wiring.
3. Panel display + selection focus.
4. Recrop front PNG.
5. Vitest + manual pass; then phase 2 planning if needed.
