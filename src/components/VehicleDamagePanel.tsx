'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DamageRegionOverlay } from '@/components/DamageRegionOverlay';
import { dbService } from '@/lib/db';
import {
  eventsWithRegionForSide,
  isValidRegion,
  latestStatusBySide,
  OVERVIEW_IMAGE,
  SIDE_IMAGE,
  SIDE_LABEL,
  VEHICLE_SIDES,
} from '@/lib/vehicleDamage';
import type { VehicleDamageEvent, VehicleSide } from '@/types';

type Props = {
  vehicleId: string;
};

export function VehicleDamagePanel({ vehicleId }: Props) {
  const [events, setEvents] = useState<VehicleDamageEvent[]>([]);
  const [selectedSide, setSelectedSide] = useState<VehicleSide | 'all'>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  /** When on Overview, history hover/tap can temporarily show that side’s diagram. */
  const [overviewPeekSide, setOverviewPeekSide] = useState<VehicleSide | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const historyRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = () => {
    setEvents(dbService.getVehicleDamageEvents(vehicleId));
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, [vehicleId]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

  const latest = useMemo(() => latestStatusBySide(events, vehicleId), [events, vehicleId]);

  const timeline = useMemo(() => {
    if (selectedSide === 'all') return events;
    return events.filter((e) => e.side === selectedSide);
  }, [events, selectedSide]);

  const toggle = (s: VehicleSide) => {
    setSelectedSide((cur) => (cur === s ? 'all' : s));
    setSelectedEventId(null);
    setOverviewPeekSide(null);
  };

  const showOverview = () => {
    setSelectedSide('all');
    setSelectedEventId(null);
    setOverviewPeekSide(null);
  };

  const focusHistoryEntry = (e: VehicleDamageEvent) => {
    setSelectedEventId(e.id);
    if (selectedSide === 'all' && e.side && !e.noNewDamage) {
      setOverviewPeekSide(e.side);
    }
  };

  const diagramSide: VehicleSide | 'all' =
    selectedSide !== 'all' ? selectedSide : overviewPeekSide || 'all';

  const previewLabel =
    diagramSide === 'all'
      ? 'Overview'
      : selectedSide === 'all'
        ? `${SIDE_LABEL[diagramSide]} (from history)`
        : SIDE_LABEL[diagramSide];

  const previewLogged =
    diagramSide !== 'all' && latest[diagramSide] ? latest[diagramSide] : null;

  const markers =
    diagramSide === 'all'
      ? []
      : eventsWithRegionForSide(events, diagramSide).map((ev) => ({
          id: ev.id,
          region: ev.region!,
        }));

  return (
    <div className="stack gap-4">
      <div className="card card-pad sticky top-0 z-10 max-h-[70dvh] overflow-y-auto overscroll-contain bg-surface shadow-panel">
        <div className="spread items-start gap-2 mb-3">
          <div>
            <h2 className="card-title">Damage overview</h2>
            <p className="hint mt-1">
              Tap a side for marks, or hover / tap a history entry to preview that side. Tap a photo to
              enlarge.
            </p>
          </div>
          {(selectedSide !== 'all' || overviewPeekSide) && (
            <button type="button" className="btn btn-ghost btn-sm text-xs" onClick={showOverview}>
              Show overview
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-[var(--surface-alt,#f4f4f5)] overflow-hidden">
          <div className="spread px-3 py-2 border-b border-line">
            <span className="text-xs font-bold text-ink">{previewLabel}</span>
            {previewLogged ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                Damage logged
              </span>
            ) : diagramSide !== 'all' ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">No entry yet</span>
            ) : null}
          </div>
          <div className="flex items-center justify-center min-h-[180px] sm:min-h-[220px] p-4 sm:p-6">
            {diagramSide === 'all' ? (
              <img
                src={OVERVIEW_IMAGE}
                alt="Overview vehicle diagram"
                className="max-h-52 sm:max-h-64 w-auto max-w-full object-contain drop-shadow-sm"
              />
            ) : (
              <DamageRegionOverlay
                imageSrc={SIDE_IMAGE[diagramSide]}
                imageAlt={`${SIDE_LABEL[diagramSide]} vehicle diagram`}
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
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {VEHICLE_SIDES.map((s) => {
            const has = Boolean(latest[s]);
            const active = selectedSide === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                  active
                    ? 'bg-ink text-white border-ink'
                    : has
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-surface border-line text-ink-muted hover:border-ink/40'
                }`}
              >
                {SIDE_LABEL[s]}
                {has ? ' ·' : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card card-pad stack">
        <div className="spread items-center">
          <h2 className="card-title">
            History
            {selectedSide !== 'all' ? ` · ${SIDE_LABEL[selectedSide]}` : ''}
          </h2>
          {selectedSide !== 'all' && (
            <button type="button" className="link-action text-xs" onClick={showOverview}>
              Show all
            </button>
          )}
        </div>

        {timeline.length === 0 ? (
          <p className="hint">No damage entries yet.</p>
        ) : (
          timeline.map((e) => {
            const canPeek = selectedSide === 'all' && Boolean(e.side) && !e.noNewDamage;
            return (
              <div
                key={e.id}
                ref={(el) => {
                  historyRefs.current[e.id] = el;
                }}
                role={canPeek ? 'button' : undefined}
                tabIndex={canPeek ? 0 : undefined}
                onMouseEnter={() => {
                  if (canPeek) focusHistoryEntry(e);
                }}
                onFocus={() => {
                  if (canPeek) focusHistoryEntry(e);
                }}
                onClick={() => focusHistoryEntry(e)}
                onKeyDown={(ev) => {
                  if (!canPeek) return;
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    focusHistoryEntry(e);
                  }
                }}
                className={`border-b border-line last:border-b-0 pb-3 last:pb-0 space-y-2 rounded-lg transition-colors ${
                  selectedEventId === e.id ? 'ring-2 ring-rose-500/60 bg-rose-50/40 px-2 -mx-2' : ''
                } ${canPeek ? 'cursor-pointer hover:bg-surface-alt/60' : ''}`}
              >
                <div className="spread items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      {e.noNewDamage ? 'No new damage' : e.side ? SIDE_LABEL[e.side] : 'Damage'}
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      {new Date(e.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      · {e.userName}
                    </p>
                    {e.note && <p className="text-xs text-ink-muted mt-1">{e.note}</p>}
                    {canPeek && isValidRegion(e.region) && (
                      <p className="text-[10px] text-ink-faint mt-1">Hover or tap to preview on diagram</p>
                    )}
                  </div>
                  {e.noNewDamage ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                      Clear
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                      Damage
                    </span>
                  )}
                </div>
                {e.photoDataUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {e.photoDataUrls.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setLightboxUrl(url);
                        }}
                        className="relative p-0 rounded-lg border border-line overflow-hidden focus:outline-none focus:ring-2 focus:ring-ink/30"
                        aria-label={`Enlarge damage photo ${i + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Damage photo ${i + 1}`}
                          className="w-20 h-20 object-cover block"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Damage photo"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 btn btn-ghost btn-sm text-white bg-black/40 hover:bg-black/60"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close photo"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Damage photo enlarged"
            className="max-h-[90vh] max-w-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
