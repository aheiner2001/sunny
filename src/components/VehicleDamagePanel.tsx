'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { dbService } from '@/lib/db';
import {
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

  const load = () => {
    setEvents(dbService.getVehicleDamageEvents(vehicleId));
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
  }, [vehicleId]);

  const latest = useMemo(() => latestStatusBySide(events, vehicleId), [events, vehicleId]);

  const timeline = useMemo(() => {
    if (selectedSide === 'all') return events;
    return events.filter((e) => e.side === selectedSide);
  }, [events, selectedSide]);

  const toggle = (s: VehicleSide) => setSelectedSide((cur) => (cur === s ? 'all' : s));

  const previewSrc = selectedSide === 'all' ? OVERVIEW_IMAGE : SIDE_IMAGE[selectedSide];
  const previewLabel = selectedSide === 'all' ? 'Overview' : SIDE_LABEL[selectedSide];
  const previewLogged =
    selectedSide !== 'all' && latest[selectedSide] ? latest[selectedSide] : null;

  return (
    <div className="stack gap-4">
      <div className="card card-pad">
        <div className="spread items-start gap-2 mb-3">
          <div>
            <h2 className="card-title">Damage overview</h2>
            <p className="hint mt-1">Tap a side to preview the van and filter history.</p>
          </div>
          {selectedSide !== 'all' && (
            <button type="button" className="btn btn-ghost btn-sm text-xs" onClick={() => setSelectedSide('all')}>
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
            ) : selectedSide !== 'all' ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">No entry yet</span>
            ) : null}
          </div>
          <div className="flex items-center justify-center min-h-[180px] sm:min-h-[220px] p-4 sm:p-6">
            <img
              src={previewSrc}
              alt={`${previewLabel} vehicle diagram`}
              className="max-h-52 sm:max-h-64 w-auto max-w-full object-contain drop-shadow-sm"
            />
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
            <button type="button" className="link-action text-xs" onClick={() => setSelectedSide('all')}>
              Show all
            </button>
          )}
        </div>

        {timeline.length === 0 ? (
          <p className="hint">No damage entries yet.</p>
        ) : (
          timeline.map((e) => (
            <div key={e.id} className="border-b border-line last:border-b-0 pb-3 last:pb-0 space-y-2">
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
                    <img
                      key={i}
                      src={url}
                      alt={`Damage photo ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-line"
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
