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
