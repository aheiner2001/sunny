'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { dbService } from '@/lib/db';
import { latestStatusBySide } from '@/lib/vehicleDamage';
import type { VehicleDamageEvent, VehicleSide } from '@/types';

const SIDE_LABEL: Record<VehicleSide, string> = {
  front: 'Front',
  rear: 'Rear',
  left: 'Left',
  right: 'Right',
};

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

  return (
    <div className="stack gap-4">
      <div className="card card-pad">
        <h2 className="card-title mb-3">Damage overview</h2>
        <div className="mx-auto max-w-xs grid grid-cols-3 gap-2 place-items-center">
          <div />
          <SideTile
            side="front"
            event={latest.front}
            active={selectedSide === 'front'}
            onSelect={() => setSelectedSide((s) => (s === 'front' ? 'all' : 'front'))}
          />
          <div />
          <SideTile
            side="left"
            event={latest.left}
            active={selectedSide === 'left'}
            onSelect={() => setSelectedSide((s) => (s === 'left' ? 'all' : 'left'))}
          />
          <div className="w-16 h-24 rounded-xl border-2 border-dashed border-line bg-surface-sunk flex items-center justify-center text-[10px] font-bold text-ink-faint uppercase tracking-wider">
            Van
          </div>
          <SideTile
            side="right"
            event={latest.right}
            active={selectedSide === 'right'}
            onSelect={() => setSelectedSide((s) => (s === 'right' ? 'all' : 'right'))}
          />
          <div />
          <SideTile
            side="rear"
            event={latest.rear}
            active={selectedSide === 'rear'}
            onSelect={() => setSelectedSide((s) => (s === 'rear' ? 'all' : 'rear'))}
          />
          <div />
        </div>
        <p className="hint mt-3 text-center">
          Tap a side to filter history. Empty sides have no damage logged yet.
        </p>
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
                    {e.noNewDamage
                      ? 'No new damage'
                      : e.side
                        ? SIDE_LABEL[e.side]
                        : 'Damage'}
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

function SideTile({
  side,
  event,
  active,
  onSelect,
}: {
  side: VehicleSide;
  event: VehicleDamageEvent | null;
  active: boolean;
  onSelect: () => void;
}) {
  const thumb = event?.photoDataUrls?.[0];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-20 h-16 rounded-xl border text-left overflow-hidden transition-all ${
        active
          ? 'border-ink ring-2 ring-ink/20'
          : event
            ? 'border-amber-400'
            : 'border-line'
      } bg-surface`}
      title={SIDE_LABEL[side]}
    >
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-10 object-cover" />
      ) : (
        <div className="h-10 bg-surface-sunk" />
      )}
      <div className="px-1.5 py-0.5 text-[10px] font-bold text-ink truncate">
        {SIDE_LABEL[side]}
        {event ? ' · logged' : ''}
      </div>
    </button>
  );
}

