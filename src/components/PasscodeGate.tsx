'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Delete, Lock, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { asset } from '@/lib/basePath';

const MAX_LENGTH = 8;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const LOGO_SRC = asset('/sunny-logo.png');

function PasscodePad({
  onSuccess,
  submitLabel,
  autoFocus = true,
}: {
  onSuccess: () => void;
  submitLabel: string;
  autoFocus?: boolean;
}) {
  const { loginWithPasscode } = useAuth();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const entryRef = useRef('');

  const writeEntry = (next: string) => {
    entryRef.current = next;
    setEntry(next);
  };

  const submit = (code: string) => {
    const result = loginWithPasscode(code);
    writeEntry('');
    if (result.success) {
      setError(null);
      onSuccess();
    } else {
      setError(result.error || 'Sign in failed.');
    }
  };

  const press = (digit: string) => {
    setError(null);
    if (entryRef.current.length >= MAX_LENGTH) return;
    writeEntry(entryRef.current + digit);
  };

  const backspace = () => {
    setError(null);
    writeEntry(entryRef.current.slice(0, -1));
  };

  const clear = () => {
    setError(null);
    writeEntry('');
  };

  useEffect(() => {
    if (!autoFocus) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (/^[0-9]$/.test(e.key)) {
        press(e.key);
      } else if (e.key === 'Backspace') {
        backspace();
      } else if (e.key === 'Enter' && entryRef.current.length > 0) {
        submit(entryRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [autoFocus]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2.5 h-10 mb-2">
        {entry.length === 0 ? (
          <span className="text-xs font-semibold text-ink-faint">Enter your passcode</span>
        ) : (
          Array.from({ length: entry.length }).map((_, i) => (
            <span key={i} className="w-3 h-3 rounded-full bg-ink shadow-sm" />
          ))
        )}
      </div>

      <div className="h-8 flex items-center justify-center">
        {error && (
          <p className="text-xs font-semibold text-[var(--critical)] bg-[var(--critical-wash)] border border-[var(--critical)]/20 px-3 py-1.5 rounded-[var(--radius)]">
            {error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 mt-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="h-14 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] border border-line text-xl font-bold text-ink hover:bg-[var(--info-wash)] hover:border-line-strong active:scale-95 transition-all"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="h-14 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] border border-line text-2xs font-bold uppercase tracking-wider text-ink-muted hover:bg-[var(--idle-wash)] active:scale-95 transition-all"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => press('0')}
          className="h-14 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] border border-line text-xl font-bold text-ink hover:bg-[var(--info-wash)] hover:border-line-strong active:scale-95 transition-all"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          aria-label="Delete last digit"
          className="h-14 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] border border-line text-ink-muted flex items-center justify-center hover:bg-[var(--idle-wash)] active:scale-95 transition-all"
        >
          <Delete className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        disabled={entry.length === 0}
        onClick={() => submit(entry)}
        className="btn btn-primary btn-block mt-4"
      >
        {submitLabel}
      </button>
    </div>
  );
}

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const { hydrated, isAuthenticated } = useAuth();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 rounded-full border-2 border-line border-t-ink animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="card card-pad w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-4">
          <img src={LOGO_SRC} alt="Sunny logo" className="h-12 w-36 object-contain mb-3" />
          <div className="badge" data-status="info">
            <Lock className="h-3 w-3" aria-hidden />
            Fleet Access
          </div>
          <h1 className="card-title mt-3">Sign in to continue</h1>
          <p className="hint mt-1">
            Enter your personal passcode. Manager codes unlock the full fleet console.
          </p>
        </div>

        <PasscodePad onSuccess={() => undefined} submitLabel="Sign In" />
      </div>
    </div>
  );
}

export function PasscodePrompt({
  isOpen,
  onClose,
  onSuccess,
  targetLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetLabel?: string | null;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card max-w-sm w-full overflow-hidden">
        <div className="card-head bg-ink text-ink-inverse">
          <div className="cluster min-w-0">
            <span className="icon-tile bg-hivis text-ink shrink-0" aria-hidden>
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title text-ink-inverse">Session expired</h2>
              <p className="text-2xs text-ink-faint truncate">
                {targetLabel ? `Re-enter your code to open ${targetLabel}` : 'Re-enter your code to continue'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="btn btn-ghost btn-sm shrink-0 text-ink-faint hover:text-ink-inverse"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="card-pad">
          <PasscodePad onSuccess={onSuccess} submitLabel="Unlock & Continue" />
        </div>
      </div>
    </div>
  );
}
