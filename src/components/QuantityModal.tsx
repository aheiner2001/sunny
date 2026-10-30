'use client';

import React, { useEffect, useState } from 'react';
import { parseQuantityInput } from '@/lib/quantityModal';
import { playSwitchSound } from '@/lib/switchAudio';

export function QuantityModal({
  open,
  title,
  description,
  initialValue,
  min,
  max,
  allowEmpty,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  initialValue: number;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  onConfirm: (qty: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      playSwitchSound('popup', 0.25);
      setValue(String(initialValue));
      setError(null);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseQuantityInput(value, { min, max, allowEmpty });
    if (!result.ok) {
      playSwitchSound('klick', 0.25);
      setError(result.error);
      return;
    }
    setError(null);
    playSwitchSound('klick', 0.25);
    onConfirm(result.value);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
      onClick={() => {
        playSwitchSound('klick', 0.25);
        onCancel();
      }}
    >
      <div
        className="switch-modal-dialog p-6 sm:p-8 max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantity-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="quantity-modal-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-slate-600 mb-6">{description}</p>
        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <label className="label text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="quantity-modal-input">
              Quantity
            </label>
            <input
              id="quantity-modal-input"
              type="number"
              min={0}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              className="input rounded-full px-4 py-2 border-2 border-slate-200 focus:border-[#00c3e3] focus:ring-2 focus:ring-[#00c3e3]/20"
              aria-invalid={error ? true : undefined}
              autoFocus
            />
            {error ? (
              <p className="hint text-xs text-rose-600 font-bold mt-1.5" data-status="critical">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              className="btn btn-secondary px-6"
              onClick={() => {
                playSwitchSound('klick', 0.25);
                onCancel();
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary px-6">
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
