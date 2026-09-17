'use client';

import React, { useState } from 'react';
import { Equipment } from '@/types';
import { dbService } from '@/lib/db';
import { calculateWearForecast } from '@/lib/lifespan';
import { Sparkles, Calendar, RotateCcw, AlertTriangle, Archive, History, Clock, TrendingUp } from 'lucide-react';

interface LifespanActionModalProps {
  item: Equipment | null;
  mode: 'extend' | 'replace' | 'retire' | 'unretire' | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LifespanActionModal({
  item,
  mode,
  onClose,
  onSuccess
}: LifespanActionModalProps) {
  const [extensionAmount, setExtensionAmount] = useState('50');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<'working' | 'flagged'>('working');

  if (!item || !mode) return null;

  const isUsage = item.lifespanMode === 'usage';
  const avgJobs = item.vehicleId ? dbService.getVehicleAvgDailyJobs(item.vehicleId) : 3.5;
  const forecast = calculateWearForecast(item, avgJobs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = dbService.getSession();
      const user = session ? dbService.getUser(session.userId) : null;
      const meta = {
        userId: user?.id || null,
        userName: user?.name || 'Manager',
        reason: reason.trim() || undefined,
      };

      if (mode === 'extend') {
        const amount = Number(extensionAmount);
        if (!Number.isInteger(amount) || amount <= 0) {
          throw new Error(`Enter a positive whole number of ${isUsage ? 'cars' : 'months'}.`);
        }
        await dbService.extendEquipmentLifespan(item.id, amount, meta);
      } else if (mode === 'replace') {
        await dbService.replaceEquipmentLifespan(item.id, meta);
      } else if (mode === 'retire') {
        await dbService.retireEquipment(item.id, meta);
      } else if (mode === 'unretire') {
        await dbService.unretireEquipment(item.id, {
          ...meta,
          restoreStatus,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card card-pad max-w-lg w-full my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lifespan-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cluster mb-3 spread items-start">
          <div className="cluster gap-2.5">
            <span className="icon-tile" data-status={mode === 'retire' ? 'critical' : 'info'}>
              {mode === 'extend' && (isUsage ? <Sparkles className="w-5 h-5" /> : <Calendar className="w-5 h-5" />)}
              {mode === 'replace' && <RotateCcw className="w-5 h-5" />}
              {mode === 'retire' && <Archive className="w-5 h-5" />}
              {mode === 'unretire' && <RotateCcw className="w-5 h-5" />}
            </span>
            <div>
              <h2 id="lifespan-modal-title" className="card-title">
                {mode === 'extend' && `Extend Lifespan: ${item.name}`}
                {mode === 'replace' && `Mark Replaced: ${item.name}`}
                {mode === 'retire' && `Retire Tool: ${item.name}`}
                {mode === 'unretire' && `Un-retire Tool: ${item.name}`}
              </h2>
              <p className="hint text-xs">{item.vehicleNumber ? `Assigned to ${item.vehicleNumber}` : 'In shop / unassigned'}</p>
            </div>
          </div>
          {item.lifespanHistory && item.lifespanHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="btn btn-ghost btn-xs cluster gap-1 text-xs"
            >
              <History className="w-3.5 h-3.5" />
              {showHistory ? 'Hide History' : `History (${item.lifespanHistory.length})`}
            </button>
          )}
        </div>

        {/* 2.3 Predictive Wear Forecast Widget */}
        <div className="card card-pad bg-[var(--surface-alt)] text-xs mb-3 stack-tight border border-line">
          <div className="cluster gap-1.5 font-semibold text-ink">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span>Predictive Wear Forecast</span>
          </div>
          <p className="text-ink-muted">{forecast.forecastText}</p>
        </div>

        {error && (
          <div className="card card-pad bg-[var(--critical-wash)] text-[var(--critical-text)] text-sm mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="stack gap-3">
          {mode === 'extend' && (
            <div className="field">
              <label className="label" htmlFor="extension-amount">
                {isUsage ? 'Add expected cars' : 'Add lifespan duration (months)'}
              </label>
              <input
                id="extension-amount"
                type="number"
                min="1"
                step="1"
                required
                value={extensionAmount}
                onChange={(e) => setExtensionAmount(e.target.value)}
                className="input"
                placeholder={isUsage ? 'e.g. 50' : 'e.g. 6'}
              />
              <p className="hint">
                {isUsage
                  ? `Current life: ${item.carsUsed ?? 0} cars worn out of ${item.expectedCars ?? 0} expected.`
                  : `Current due date: ${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A'}.`}
              </p>
            </div>
          )}

          {mode === 'replace' && (
            <p className="text-sm text-ink-muted leading-relaxed">
              {isUsage
                ? `Confirming that this ${item.name} has been swapped with a fresh tool. This will reset cars cleaned back to 0.`
                : `Confirming that this ${item.name} has been replaced. A new ${item.expectedMonths || 12}-month life cycle will begin starting today.`}
            </p>
          )}

          {mode === 'retire' && (
            <p className="text-sm text-[var(--critical-text)] leading-relaxed">
              Are you sure you want to retire this tool? It will be taken out of service, excluded from van job wear calculations, and removed from due review queues.
            </p>
          )}

          {/* 2.1 Audit reason input */}
          <div className="field mt-1">
            <label className="label text-xs" htmlFor="action-reason">
              Reason / Manager Notes (recorded in audit log)
            </label>
            <input
              id="action-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input text-xs"
              placeholder={mode === 'extend' ? 'e.g. Bristles still in great shape' : mode === 'replace' ? 'e.g. Scheduled bi-monthly rotation' : 'e.g. Damaged during mobile run'}
            />
          </div>

          {/* 2.1 Timeline Audit Log Drawer */}
          {showHistory && item.lifespanHistory && item.lifespanHistory.length > 0 && (
            <div className="stack gap-2 pt-2 border-t border-line">
              <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Lifespan Audit History</h4>
              <div className="max-h-40 overflow-y-auto stack-tight gap-1.5 pr-1">
                {item.lifespanHistory.map((log) => (
                  <div key={log.id} className="p-2 rounded bg-surface border border-line text-xs">
                    <div className="spread items-center">
                      <span className="font-semibold capitalize text-primary">{log.action}</span>
                      <time className="unit-tag text-[10px]">
                        {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                    <p className="text-ink mt-0.5">{log.reason || 'No reason provided'}</p>
                    {log.userName && <p className="hint text-[10px] mt-0.5">By: {log.userName}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="cluster justify-end mt-4 gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-sm ${mode === 'retire' ? 'btn-critical' : 'btn-primary'}`}
            >
              {loading ? 'Processing...' : (
                mode === 'extend'
                  ? 'Extend Life'
                  : mode === 'replace'
                    ? 'Mark Replaced'
                    : mode === 'unretire'
                      ? 'Confirm Un-retire'
                      : 'Retire Tool'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

