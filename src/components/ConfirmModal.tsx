'use client';

import React, { useEffect, useRef } from 'react';
import { playSwitchSound } from '@/lib/switchAudio';

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'default',
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    playSwitchSound('popup', 0.3);
    confirmRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        playSwitchSound('klick', 0.25);
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
      onClick={() => {
        playSwitchSound('klick', 0.25);
        onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="switch-modal-dialog p-6 sm:p-8 max-w-md w-full text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-slate-600 mb-8 leading-relaxed">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="btn btn-secondary px-6"
            onClick={() => {
              playSwitchSound('klick', 0.25);
              onCancel();
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`${confirmClass} px-6`}
            onClick={() => {
              playSwitchSound('klick', 0.25);
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
