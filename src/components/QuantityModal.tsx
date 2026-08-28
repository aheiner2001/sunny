'use client';

import React, { useEffect, useState } from 'react';
import { parseQuantityInput } from '@/lib/quantityModal';

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
      setValue(String(initialValue));
      setError(null);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseQuantityInput(value, { min, max, allowEmpty });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onConfirm(result.value);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="card card-pad max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantity-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="quantity-modal-title" className="card-title mb-2">
          {title}
        </h2>
        <p className="text-sm text-ink-muted mb-4">{description}</p>
        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <label className="label" htmlFor="quantity-modal-input">
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
              className="input"
              aria-invalid={error ? true : undefined}
              autoFocus
            />
            {error ? (
              <p className="hint" data-status="critical">
                {error}
              </p>
            ) : null}
          </div>
          <div className="cluster justify-end">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
