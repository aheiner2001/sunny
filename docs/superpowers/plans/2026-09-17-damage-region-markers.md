# Damage Region Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drivers draw one required box on the Maverick side diagram when recording damage on return; the vehicle Damage tab shows all historical red boxes per side and tapping a box focuses that history entry; recrop front art.

**Architecture:** Store a normalized `DamageRegion` (`x,y,w,h` in 0–1) on each `VehicleDamageEvent`. Shared `DamageRegionOverlay` supports draw mode (capture) and display/select mode (panel). Helpers clamp/validate regions; `dbService` persists them like other damage fields. Photos stay data URLs.

**Tech Stack:** Next.js 14 static export, TypeScript, React 18, Tailwind, Vitest, existing `dbService` + localStorage/Firestore.

**Spec:** `docs/superpowers/specs/2026-09-17-damage-region-markers-design.md`

## Global Constraints

- Respect `BASE_PATH` / `asset()` for all diagram URLs (already on `SIDE_IMAGE` / `OVERVIEW_IMAGE`).
- Photos: compressed JPEG data URLs only — no Firebase Storage.
- Exactly one region per damage event; required when `!noNewDamage`.
- Coordinates normalized 0–1 relative to the side diagram; clamp so `x+w ≤ 1` and `y+h ≤ 1`.
- Minimum region size: `MIN_REGION_SIZE = 0.02` (2% of image width and height).
- Phase 1: no create/edit from Damage overview (view + select only).
- Overview (`selectedSide === 'all'`): top-down image, **no** region boxes.
- Legacy events without `region`: show in history, no box.
- TDD for lib helpers; `npm test -- src/lib/vehicleDamage.test.ts` and `npx tsc --noEmit`.
- Frequent commits; do not commit `tsconfig.tsbuildinfo`.
- Work on a feature branch off `main` (e.g. `feat/damage-region-markers`).

## File map

| File | Responsibility |
| --- | --- |
| `src/types/index.ts` | `DamageRegion` type; optional `region` on `VehicleDamageEvent` |
| `src/lib/vehicleDamage.ts` | `MIN_REGION_SIZE`, `normalizeRegion`, `isValidRegion`, `assertDamagePayload` region rule, `eventsWithRegionForSide` |
| `src/lib/vehicleDamage.test.ts` | Unit tests for helpers |
| `src/lib/db.ts` | Pass `region` through `addVehicleDamageEvent` |
| `src/components/DamageRegionOverlay.tsx` | Draw / display overlay on side diagram |
| `src/components/VehicleDamageCapture.tsx` | Show overlay after side pick; require region on save |
| `src/components/VehicleDamagePanel.tsx` | Display boxes per side; tap → focus history row |
| `public/vehicle-damage/maverick/front.png` | Recropped front art |

---

### Task 1: Types + region helpers (TDD)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/vehicleDamage.ts`
- Modify: `src/lib/vehicleDamage.test.ts`

**Interfaces:**
- Consumes: existing `VehicleDamageEvent`, `VehicleSide`
- Produces:
  - `export type DamageRegion = { x: number; y: number; w: number; h: number }`
  - `VehicleDamageEvent.region?: DamageRegion`
  - `export const MIN_REGION_SIZE = 0.02`
  - `normalizeRegion(raw: DamageRegion): DamageRegion`
  - `isValidRegion(region: DamageRegion | null | undefined): boolean`
  - `assertDamagePayload` accepts optional `region?: DamageRegion | null` and requires a valid region when `!noNewDamage`
  - `eventsWithRegionForSide(events: VehicleDamageEvent[], side: VehicleSide): VehicleDamageEvent[]`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/vehicleDamage.test.ts` (keep existing tests; update damage-without-side and photo-limit calls to pass a valid `region` so they stay focused):

```ts
import {
  assertDamagePayload,
  eventsWithRegionForSide,
  isValidRegion,
  latestStatusBySide,
  MIN_REGION_SIZE,
  normalizeRegion,
} from './vehicleDamage';
import type { DamageRegion, VehicleDamageEvent } from '@/types';

const validRegion: DamageRegion = { x: 0.1, y: 0.2, w: 0.3, h: 0.25 };

// In existing tests that call assertDamagePayload with noNewDamage: false, add:
// region: validRegion

describe('damage regions', () => {
  it('normalizeRegion clamps into 0–1 and preserves positive size', () => {
    expect(normalizeRegion({ x: -0.1, y: 0.9, w: 0.5, h: 0.5 })).toEqual({
      x: 0,
      y: 0.5,
      w: 0.5,
      h: 0.5,
    });
  });

  it('isValidRegion rejects missing, zero, or undersized regions', () => {
    expect(isValidRegion(undefined)).toBe(false);
    expect(isValidRegion({ x: 0, y: 0, w: 0, h: 0.5 })).toBe(false);
    expect(isValidRegion({ x: 0, y: 0, w: MIN_REGION_SIZE / 2, h: MIN_REGION_SIZE })).toBe(false);
    expect(isValidRegion(validRegion)).toBe(true);
  });

  it('requires region when reporting damage', () => {
    expect(() =>
      assertDamagePayload({
        noNewDamage: false,
        side: 'front',
        photoDataUrls: ['x'],
        region: null,
      })
    ).toThrow(/region|box|mark/i);
  });

  it('allows noNewDamage without region', () => {
    expect(() =>
      assertDamagePayload({
        noNewDamage: true,
        side: null,
        photoDataUrls: [],
        region: null,
      })
    ).not.toThrow();
  });

  it('eventsWithRegionForSide returns only matching side events that have a region', () => {
    const events = [
      event({
        id: '1',
        side: 'front',
        createdAt: '2026-01-01T00:00:00.000Z',
        region: validRegion,
      }),
      event({
        id: '2',
        side: 'front',
        createdAt: '2026-01-02T00:00:00.000Z',
        // no region — legacy
      }),
      event({
        id: '3',
        side: 'left',
        createdAt: '2026-01-03T00:00:00.000Z',
        region: validRegion,
      }),
    ];
    expect(eventsWithRegionForSide(events, 'front').map((e) => e.id)).toEqual(['1']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/vehicleDamage.test.ts`

Expected: FAIL — `normalizeRegion` / `isValidRegion` / `eventsWithRegionForSide` not exported; region assertion missing.

- [ ] **Step 3: Add types**

In `src/types/index.ts`, above `VehicleDamageEvent`:

```ts
export type DamageRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};
```

Add to `VehicleDamageEvent`:

```ts
  region?: DamageRegion;
```

- [ ] **Step 4: Implement helpers in `src/lib/vehicleDamage.ts`**

```ts
import type { DamageRegion, VehicleDamageEvent, VehicleSide } from '@/types';

export const MIN_REGION_SIZE = 0.02;

export function normalizeRegion(raw: DamageRegion): DamageRegion {
  let x = Number.isFinite(raw.x) ? raw.x : 0;
  let y = Number.isFinite(raw.y) ? raw.y : 0;
  let w = Number.isFinite(raw.w) ? raw.w : 0;
  let h = Number.isFinite(raw.h) ? raw.h : 0;

  w = Math.max(0, w);
  h = Math.max(0, h);
  x = Math.min(Math.max(0, x), 1);
  y = Math.min(Math.max(0, y), 1);
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return { x, y, w, h };
}

export function isValidRegion(region: DamageRegion | null | undefined): boolean {
  if (!region) return false;
  const r = normalizeRegion(region);
  return r.w >= MIN_REGION_SIZE && r.h >= MIN_REGION_SIZE;
}

export function eventsWithRegionForSide(
  events: VehicleDamageEvent[],
  side: VehicleSide
): VehicleDamageEvent[] {
  return events.filter((e) => e.side === side && isValidRegion(e.region));
}
```

Update `assertDamagePayload`:

```ts
export function assertDamagePayload(args: {
  noNewDamage: boolean;
  side: VehicleSide | null;
  photoDataUrls: string[];
  region?: DamageRegion | null;
}): void {
  const { noNewDamage, side, photoDataUrls, region } = args;
  if (photoDataUrls.length > MAX_DAMAGE_PHOTOS) {
    throw new Error(`At most ${MAX_DAMAGE_PHOTOS} photos per damage entry`);
  }
  if (noNewDamage) {
    return;
  }
  if (!side) {
    throw new Error('Pick a vehicle side when reporting damage');
  }
  if (photoDataUrls.length < 1) {
    throw new Error('Add at least one photo when reporting damage');
  }
  if (!isValidRegion(region)) {
    throw new Error('Draw a box on the diagram to mark where the damage is');
  }
}
```

Update existing tests that assert damage with `noNewDamage: false` to include `region: validRegion`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/vehicleDamage.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/vehicleDamage.ts src/lib/vehicleDamage.test.ts
git commit -m "feat: add DamageRegion helpers and require region on damage"
```

---

### Task 2: Persist region in `dbService`

**Files:**
- Modify: `src/lib/db.ts` (`addVehicleDamageEvent` ~3420–3469)

**Interfaces:**
- Consumes: `assertDamagePayload`, `normalizeRegion`, `DamageRegion`
- Produces: `addVehicleDamageEvent` input includes `region?: DamageRegion | null`; saved event stores normalized `region` when `!noNewDamage`, omits/undefined when `noNewDamage`

- [ ] **Step 1: Update `addVehicleDamageEvent` signature and body**

Import `normalizeRegion` from `@/lib/vehicleDamage` (alongside existing `assertDamagePayload` import if present; otherwise add both).

Change input type to include:

```ts
    region?: DamageRegion | null;
```

Inside the method, after slicing photos:

```ts
    const region =
      input.noNewDamage || !input.region ? null : normalizeRegion(input.region);

    assertDamagePayload({
      noNewDamage: input.noNewDamage,
      side: input.noNewDamage ? null : input.side,
      photoDataUrls: input.noNewDamage ? [] : photoDataUrls,
      region,
    });

    const event: VehicleDamageEvent = {
      id: `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      vehicleId: input.vehicleId,
      side: input.noNewDamage ? null : input.side,
      noNewDamage: Boolean(input.noNewDamage),
      note: input.note?.trim() || undefined,
      photoDataUrls: input.noNewDamage ? [] : photoDataUrls,
      region: input.noNewDamage || !region ? undefined : region,
      inspectionId: input.inspectionId ?? null,
      userId: input.userId,
      userName: input.userName,
      createdAt: new Date().toISOString(),
    };
```

Ensure `DamageRegion` is imported from `@/types` in `db.ts` if not already.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no new type errors from `db.ts`. Capture still compiles because `region` is optional on the input until Task 4 wires it (runtime validation enforces it).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: persist damage region on VehicleDamageEvent writes"
```

---

### Task 3: `DamageRegionOverlay` component

**Files:**
- Create: `src/components/DamageRegionOverlay.tsx`

**Interfaces:**
- Consumes: `DamageRegion` from `@/types`; image `src` string from parent
- Produces:

```ts
export type DamageRegionOverlayProps = {
  imageSrc: string;
  imageAlt: string;
  mode: 'draw' | 'display';
  value?: DamageRegion | null;
  onChange?: (region: DamageRegion | null) => void;
  markers?: Array<{ id: string; region: DamageRegion }>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};
```

- [ ] **Step 1: Create the component**

```tsx
'use client';

import React, { useCallback, useRef, useState } from 'react';
import type { DamageRegion } from '@/types';
import { isValidRegion, MIN_REGION_SIZE, normalizeRegion } from '@/lib/vehicleDamage';

export type DamageRegionOverlayProps = {
  imageSrc: string;
  imageAlt: string;
  mode: 'draw' | 'display';
  value?: DamageRegion | null;
  onChange?: (region: DamageRegion | null) => void;
  markers?: Array<{ id: string; region: DamageRegion }>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function clientToNorm(
  el: HTMLElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const x = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const y = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

function fromDrag(a: { x: number; y: number }, b: { x: number; y: number }): DamageRegion {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  return normalizeRegion({ x, y, w, h });
}

export function DamageRegionOverlay({
  imageSrc,
  imageAlt,
  mode,
  value = null,
  onChange,
  markers = [],
  selectedId = null,
  onSelect,
}: DamageRegionOverlayProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<DamageRegion | null>(null);

  const displayRegion = mode === 'draw' ? draft ?? value : null;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'draw' || !frameRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const origin = clientToNorm(frameRef.current, e.clientX, e.clientY);
      dragOrigin.current = origin;
      setDraft({ x: origin.x, y: origin.y, w: 0, h: 0 });
    },
    [mode]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'draw' || !dragOrigin.current || !frameRef.current) return;
      const cur = clientToNorm(frameRef.current, e.clientX, e.clientY);
      setDraft(fromDrag(dragOrigin.current, cur));
    },
    [mode]
  );

  const finishDrag = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'draw' || !dragOrigin.current || !frameRef.current) return;
      const cur = clientToNorm(frameRef.current, e.clientX, e.clientY);
      const next = fromDrag(dragOrigin.current, cur);
      dragOrigin.current = null;
      if (!isValidRegion(next)) {
        setDraft(null);
        onChange?.(null);
        return;
      }
      setDraft(next);
      onChange?.(next);
    },
    [mode, onChange]
  );

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div
        ref={frameRef}
        className={`relative inline-block max-w-full touch-none select-none ${
          mode === 'draw' ? 'cursor-crosshair' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <img
          src={imageSrc}
          alt={imageAlt}
          draggable={false}
          className="max-h-52 sm:max-h-64 w-auto max-w-full object-contain drop-shadow-sm block"
        />
        {mode === 'display' &&
          markers.map((m) => {
            const r = normalizeRegion(m.region);
            const active = m.id === selectedId;
            return (
              <button
                key={m.id}
                type="button"
                aria-label="Damage mark"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect?.(m.id);
                }}
                className={`absolute border-2 ${
                  active
                    ? 'border-rose-600 bg-rose-500/30'
                    : 'border-rose-500 bg-rose-500/15 hover:bg-rose-500/25'
                }`}
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                }}
              />
            );
          })}
        {mode === 'draw' && displayRegion && isValidRegion(displayRegion) && (
          <div
            className="absolute border-2 border-rose-600 bg-rose-500/20 pointer-events-none"
            style={{
              left: `${displayRegion.x * 100}%`,
              top: `${displayRegion.y * 100}%`,
              width: `${displayRegion.w * 100}%`,
              height: `${displayRegion.h * 100}%`,
            }}
          />
        )}
        {mode === 'draw' &&
          displayRegion &&
          !isValidRegion(displayRegion) &&
          displayRegion.w > 0 && (
            <div
              className="absolute border-2 border-dashed border-rose-400/70 bg-rose-400/10 pointer-events-none"
              style={{
                left: `${displayRegion.x * 100}%`,
                top: `${displayRegion.y * 100}%`,
                width: `${Math.max(displayRegion.w, MIN_REGION_SIZE / 2) * 100}%`,
                height: `${Math.max(displayRegion.h, MIN_REGION_SIZE / 2) * 100}%`,
              }}
            />
          )}
      </div>
      {mode === 'draw' && (
        <p className="text-[11px] text-ink-muted text-center">
          Drag on the diagram to mark the damage. Draw again to replace the box.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS for this file (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/DamageRegionOverlay.tsx
git commit -m "feat: add DamageRegionOverlay for draw and display modes"
```

---

### Task 4: Wire capture (return flow)

**Files:**
- Modify: `src/components/VehicleDamageCapture.tsx`

**Interfaces:**
- Consumes: `DamageRegionOverlay`, `SIDE_IMAGE`, `DamageRegion`, `isValidRegion`
- Produces: save path always sends `region` when `!noNewDamage`

- [ ] **Step 1: Add region state and overlay after side is chosen**

Add imports:

```ts
import { DamageRegionOverlay } from '@/components/DamageRegionOverlay';
import {
  MAX_DAMAGE_PHOTOS,
  SIDE_IMAGE,
  SIDE_LABEL,
  VEHICLE_SIDES,
  isValidRegion,
} from '@/lib/vehicleDamage';
import type { DamageRegion, User, VehicleDamageEvent, VehicleSide } from '@/types';
```

Add state:

```ts
  const [region, setRegion] = useState<DamageRegion | null>(null);
```

When changing side, clear region:

```ts
                  onClick={() => {
                    setSide(s);
                    setPhotos([]);
                    setRegion(null);
                    setSaved(false);
                    setError(null);
                  }}
```

When enabling “No new damage”, clear region:

```ts
            setNoNewDamage(e.target.checked);
            if (e.target.checked) setRegion(null);
```

After the side picker block (still inside `!noNewDamage`), when `side` is set, render:

```tsx
          {side && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                Mark damage on diagram
              </label>
              <DamageRegionOverlay
                imageSrc={SIDE_IMAGE[side]}
                imageAlt={`${SIDE_LABEL[side]} diagram`}
                mode="draw"
                value={region}
                onChange={(r) => {
                  setRegion(r);
                  setSaved(false);
                  setError(null);
                }}
              />
            </div>
          )}
```

In `handleRecord`, pass region and optionally pre-check:

```ts
      if (!noNewDamage && !isValidRegion(region)) {
        setError('Draw a box on the diagram to mark where the damage is');
        setBusy(false);
        return;
      }
      const event = await dbService.addVehicleDamageEvent({
        vehicleId,
        side: noNewDamage ? null : (side as VehicleSide) || null,
        noNewDamage,
        note: note.trim() || undefined,
        photoDataUrls: noNewDamage ? [] : photos,
        region: noNewDamage ? null : region,
        userId: user.id,
        userName: user.name,
      });
      setSaved(true);
      setNote('');
      setPhotos([]);
      setRegion(null);
```

- [ ] **Step 2: Manual smoke (local)**

Run: `npm run dev` → open return flow for a vehicle → pick Front → drag a box → add a photo → save. Confirm no error.

- [ ] **Step 3: Commit**

```bash
git add src/components/VehicleDamageCapture.tsx
git commit -m "feat: require diagram region when capturing vehicle damage"
```

---

### Task 5: Wire Damage panel (view + select)

**Files:**
- Modify: `src/components/VehicleDamagePanel.tsx`

**Interfaces:**
- Consumes: `DamageRegionOverlay`, `eventsWithRegionForSide`
- Produces: per-side display of all markers; `selectedEventId` highlights history row and scrolls it into view

- [ ] **Step 1: Replace plain side `<img>` with overlay when a side is selected**

Add imports and state (`useRef` must be imported from React):

```ts
import { DamageRegionOverlay } from '@/components/DamageRegionOverlay';
import {
  eventsWithRegionForSide,
  latestStatusBySide,
  OVERVIEW_IMAGE,
  SIDE_IMAGE,
  SIDE_LABEL,
  VEHICLE_SIDES,
} from '@/lib/vehicleDamage';

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const historyRefs = useRef<Record<string, HTMLDivElement | null>>({});
```

When side changes via `toggle` / “Show overview”, clear selection:

```ts
  const toggle = (s: VehicleSide) => {
    setSelectedSide((cur) => (cur === s ? 'all' : s));
    setSelectedEventId(null);
  };
```

Build markers when a side is selected:

```ts
  const markers =
    selectedSide === 'all'
      ? []
      : eventsWithRegionForSide(events, selectedSide).map((e) => ({
          id: e.id,
          region: e.region!,
        }));
```

Replace the preview image block with:

```tsx
          <div className="flex items-center justify-center min-h-[180px] sm:min-h-[220px] p-4 sm:p-6">
            {selectedSide === 'all' ? (
              <img
                src={OVERVIEW_IMAGE}
                alt="Overview vehicle diagram"
                className="max-h-52 sm:max-h-64 w-auto max-w-full object-contain drop-shadow-sm"
              />
            ) : (
              <DamageRegionOverlay
                imageSrc={SIDE_IMAGE[selectedSide]}
                imageAlt={`${SIDE_LABEL[selectedSide]} vehicle diagram`}
                mode="display"
                markers={markers}
                selectedId={selectedEventId}
                onSelect={(id) => {
                  setSelectedEventId(id);
                  const node = historyRefs.current[id];
                  node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
              />
            )}
          </div>
```

Update hint copy:

```tsx
            <p className="hint mt-1">
              Tap a side to preview marks. Tap a red box to open that history entry.
            </p>
```

On each history row container, attach ref + highlight:

```tsx
          timeline.map((e) => (
            <div
              key={e.id}
              ref={(el) => {
                historyRefs.current[e.id] = el;
              }}
              className={`border-b border-line last:border-b-0 pb-3 last:pb-0 space-y-2 rounded-lg ${
                selectedEventId === e.id ? 'ring-2 ring-rose-500/60 bg-rose-50/40 px-2 -mx-2' : ''
              }`}
            >
```

Keep the existing inner markup for title, photos, etc.

- [ ] **Step 2: Manual smoke**

With a saved region from Task 4: Vehicles → van → Damage → Front → see red box → tap → history row highlights and scrolls.

- [ ] **Step 3: Commit**

```bash
git add src/components/VehicleDamagePanel.tsx
git commit -m "feat: show selectable damage regions on vehicle Damage tab"
```

---

### Task 6: Recrop front Maverick PNG

**Files:**
- Modify: `public/vehicle-damage/maverick/front.png`

**Interfaces:**
- Consumes: existing asset path (no code path rename)
- Produces: visually balanced front diagram (similar side margins to `rear.png`)

- [ ] **Step 1: Inspect current art**

Open `public/vehicle-damage/maverick/front.png` and `rear.png` side by side. Note left-side clipping on front.

- [ ] **Step 2: Recrop / re-export**

Edit in Preview / Figma / Photoshop: keep transparent PNG, same approximate height (~350–360px), center the vehicle so left and right margins feel even (match breathing room on `rear.png`). Overwrite `public/vehicle-damage/maverick/front.png` in place — do **not** change `SIDE_IMAGE.front`.

Do not stretch asymmetrically; crop/pad with transparency.

- [ ] **Step 3: Visual check**

Local Damage tab → Front chip → confirm crop looks intentional. Capture overlay still aligns (normalized coords are independent of pixel size).

- [ ] **Step 4: Commit**

```bash
git add public/vehicle-damage/maverick/front.png
git commit -m "fix: recrop Maverick front damage diagram"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run unit tests + typecheck**

```bash
npm test -- src/lib/vehicleDamage.test.ts
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 2: Manual checklist**

- [ ] Return: No new damage still saves without diagram.
- [ ] Return: Damage without box shows error.
- [ ] Return: Box + photo saves; appears on Damage tab for that side.
- [ ] Damage tab overview: no red boxes on top-down.
- [ ] Damage tab side: all historical boxes; tap focuses entry.
- [ ] Legacy event without region: still in history, no box.
- [ ] Front art looks balanced.
- [ ] After Pages deploy (when pushed): diagrams load under `/sunny` (asset paths).

- [ ] **Step 3: Push branch / open PR when ready**

Do not push unless the user asks; leave commits on the feature branch.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Normalized `region` on event | 1, 2 |
| Required region when reporting damage | 1, 4 |
| Draw on return / checkout | 4 |
| Overview view: all boxes per side, tap → entry | 5 |
| No boxes on top-down overview | 5 |
| No add-from-overview in phase 1 | 5 (display only) |
| Min size / clamp | 1, 3 |
| Legacy events without region | 1, 5 |
| `asset()` paths | already on `SIDE_IMAGE`; overlay uses parent `imageSrc` |
| Recrop front.png | 6 |
| Vitest + manual | 1, 7 |

## Out of scope (do not implement in this plan)

- Phase 2: create/edit damage from Damage overview
- Multiple regions per event
- Firebase Storage
