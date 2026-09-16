# Spec: Equipment assign / transfer + edit modal UX

**Date:** 2026-09-16  
**Status:** Fixing now  
**Evidence:** Box teach recording — Allocation modal for Air Compressor #1 shows From=Mav 2, To=shop, qty=1, Transfer greyed out. Edit modal cramped (Save below fold). Assign from shop works.

## Bugs

### 1. Transfer disabled when moving off a van (critical)
`EquipmentAllocationModal` initializes `fromId` to `__shop__` even when shop qty is 0. The From `<select>` only lists locations with `quantity > 0`, so the browser *displays* the first van while React state stays `__shop__`. Then `maxFrom === 0` keeps Transfer disabled.

**Fix:** On open/refresh, set `fromId` to the first location with quantity > 0. If current `fromId` drops to 0, re-pick. Enable Transfer when `toId` set, `fromId !== toId`, and `maxFrom > 0`.

### 2. Edit save ignores vehicle dropdown
`save()` on edit always keeps `assignments = existing` and never applies `form.vehicleId`. Changing vehicle or clearing to shop in Edit does nothing.

**Fix:** On edit save for single-unit / lifespan tools, derive assignments from `form.vehicleId` (empty → shop / `[]`). For multi-qty inventory, prefer Allocation modal; still sync primary vehicleId when form changes if only one assignment slot.

### 3. Edit modal layout
Narrow modal + long form → Save off-screen; Type/Quantity misaligned.

**Fix:** `max-h-[90vh] overflow-y-auto`, sticky footer with Cancel/Save, stack Type/Quantity cleanly on small widths, ensure backdrop click/Escape dismiss if already patterned elsewhere.

## Out of scope
Tap-to-mark damage, van art, teach skill from this recording.
