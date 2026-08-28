'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Truck, Warehouse, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, Vehicle } from '@/types';

const SHOP = '__shop__';

type Props = {
  equipment: Equipment | null;
  vehicles: Vehicle[];
  open: boolean;
  onClose: () => void;
};

export function EquipmentAllocationModal({ equipment, vehicles, open, onClose }: Props) {
  const [live, setLive] = useState<Equipment | null>(null);
  const [fromId, setFromId] = useState(SHOP);
  const [toId, setToId] = useState('');
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = (id: string) => {
    const next = dbService.getEquipmentItem(id);
    if (next) setLive(next);
  };

  useEffect(() => {
    if (!open || !equipment) return;
    refresh(equipment.id);
    setFromId(SHOP);
    setToId('');
    setQty('1');
    setError('');
  }, [open, equipment?.id]);

  const assignedQty = (eq: Equipment) =>
    (eq.assignments || []).reduce((sum, assignment) => sum + assignment.quantity, 0);

  const shopQty = live
    ? Math.max(0, live.availableQuantity ?? ((live.totalQuantity ?? 1) - assignedQty(live)))
    : 0;

  const locations = useMemo(() => {
    if (!live) return [];
    const rows: Array<{ id: string; label: string; quantity: number }> = [
      { id: SHOP, label: 'In shop / unassigned', quantity: shopQty },
    ];
    for (const a of live.assignments || []) {
      rows.push({ id: a.vehicleId, label: a.vehicleNumber, quantity: a.quantity });
    }
    return rows;
  }, [live, shopQty]);

  const maxFrom = locations.find((l) => l.id === fromId)?.quantity ?? 0;

  const transfer = async () => {
    if (!live) return;
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError('Enter a whole number greater than 0.');
      return;
    }
    if (!toId || toId === fromId) {
      setError('Choose different source and destination.');
      return;
    }
    if (amount > maxFrom) {
      setError(`Only ${maxFrom} available at the source.`);
      return;
    }

    try {
      setBusy(true);
      setError('');
      if (fromId === SHOP && toId !== SHOP) {
        await dbService.transferEquipmentQuantity(live.id, toId, amount, null);
      } else if (fromId !== SHOP && toId === SHOP) {
        await dbService.returnEquipmentToShop(live.id, fromId, amount);
      } else if (fromId !== SHOP && toId !== SHOP) {
        await dbService.transferEquipmentQuantity(live.id, toId, amount, fromId);
      } else {
        setError('Cannot move from shop to shop.');
        return;
      }
      refresh(live.id);
      setQty('1');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      setBusy(false);
    }
  };

  const assignFromShop = async (vehicleId: string) => {
    if (!live || shopQty <= 0) return;
    const amount = Math.min(shopQty, 1);
    try {
      setBusy(true);
      setError('');
      await dbService.transferEquipmentQuantity(live.id, vehicleId, amount, null);
      refresh(live.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not assign.');
    } finally {
      setBusy(false);
    }
  };

  if (!open || !live) return null;

  const unassignedVehicles = vehicles.filter(
    (v) => !(live.assignments || []).some((a) => a.vehicleId === v.id),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card card-pad max-w-lg w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocation-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="spread items-start gap-3 mb-4">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Allocation</p>
            <h2 id="allocation-title" className="card-title break-words">
              {live.name}
            </h2>
            <p className="hint mt-1">
              {live.totalQuantity ?? assignedQty(live) + shopQty} owned · {shopQty} in shop ·{' '}
              {assignedQty(live)} on trucks
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="stack mb-5">
          <p className="label mb-0">Where units are now</p>
          {locations.map((loc) => (
            <div key={loc.id} className="row" data-status={loc.id === SHOP ? 'info' : 'ok'}>
              <span className="cluster min-w-0 flex-1">
                {loc.id === SHOP ? (
                  <Warehouse className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                ) : (
                  <Truck className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                )}
                <span className="font-semibold text-sm truncate">{loc.label}</span>
              </span>
              <span className="stat-value text-base tabular-nums">{loc.quantity}</span>
            </div>
          ))}
        </div>

        {unassignedVehicles.length > 0 && shopQty > 0 && (
          <div className="card card-pad bg-[var(--surface-alt)] mb-5">
            <p className="text-xs font-bold text-ink mb-2">Quick assign from shop (+1)</p>
            <div className="cluster flex-wrap">
              {unassignedVehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void assignFromShop(v.id)}
                  className="btn btn-secondary btn-sm"
                >
                  <Truck className="h-3.5 w-3.5" aria-hidden />
                  {v.vehicleNumber}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card card-pad bg-[var(--surface-alt)] stack">
          <p className="text-xs font-bold text-ink">Move quantity</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="field">
              <span className="label">From</span>
              <select
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value);
                  setError('');
                }}
                className="select"
              >
                {locations
                  .filter((l) => l.quantity > 0)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label} ({l.quantity})
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span className="label">To</span>
              <select
                value={toId}
                onChange={(e) => {
                  setToId(e.target.value);
                  setError('');
                }}
                className="select"
              >
                <option value="">Choose destination...</option>
                <option value={SHOP}>In shop / unassigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="label">Quantity</span>
            <input
              type="number"
              min={1}
              max={maxFrom || 1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="input w-28"
            />
          </label>
          {error ? (
            <p className="hint" data-status="critical">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || !toId || maxFrom === 0}
            onClick={() => void transfer()}
            className="btn btn-primary"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            {busy ? 'Moving...' : 'Transfer'}
          </button>
        </div>

        <div className="cluster justify-end mt-4 pt-4 border-t border-line">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
