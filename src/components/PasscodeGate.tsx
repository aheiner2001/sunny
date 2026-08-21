'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Delete, Lock, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const MAX_LENGTH = 8;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const LOGO_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/sunny-logo.png`;

/**
 * Numeric keypad shared by the lock screen and the mid-scan re-auth prompt.
 * Owns the entry buffer and error text; the caller decides what a success means.
 */
function PasscodePad({
  onSuccess,
  submitLabel,
  autoFocus = true
}: {
  onSuccess: () => void;
  submitLabel: string;
  autoFocus?: boolean;
}) {
  const { loginWithPasscode } = useAuth();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Mirrors `entry` so the keydown listener can read it without re-subscribing.
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

  // Physical keyboards are common on the desktop shell; keep them working.
  useEffect(() => {
    if (!autoFocus) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // The scan modal's manual-token input can still hold focus behind the
      // re-auth prompt; let it keep its own keystrokes.
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
      {/* Entry indicator */}
      <div className="flex items-center justify-center gap-2.5 h-10 mb-2">
        {entry.length === 0 ? (
          <span className="text-xs font-semibold text-slate-400">Enter your passcode</span>
        ) : (
          Array.from({ length: entry.length }).map((_, i) => (
            <span key={i} className="w-3 h-3 rounded-full bg-sky-600 shadow-sm" />
          ))
        )}
      </div>

      <div className="h-8 flex items-center justify-center">
        {error && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg">
            {error}
          </p>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2.5 mt-2">
        {KEYS.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-xl font-bold text-slate-800 hover:bg-sky-50 hover:border-sky-300 active:scale-95 transition-all"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => press('0')}
          className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-xl font-bold text-slate-800 hover:bg-sky-50 hover:border-sky-300 active:scale-95 transition-all"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          aria-label="Delete last digit"
          className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        disabled={entry.length === 0}
        onClick={() => submit(entry)}
        className="mt-4 w-full py-3.5 rounded-2xl bg-sky-600 text-white font-bold text-sm shadow-lg shadow-sky-600/25 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none active:scale-[0.98] transition-all"
      >
        {submitLabel}
      </button>
    </div>
  );
}

/**
 * Wraps the app shell. Renders the lock screen until a valid passcode session
 * exists, so every route is covered by one mount point in the root layout.
 */
export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const { hydrated, isAuthenticated } = useAuth();

  // Avoid flashing either the lock screen or the app before localStorage is read.
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-sky-600 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-200">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-4">
          <img src={LOGO_SRC} alt="Sunny logo" className="h-12 w-36 object-contain mb-3" />
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            <span>Fleet Access</span>
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 mt-3">Sign in to continue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enter your personal passcode. Manager codes unlock the full fleet console.
          </p>
        </div>

        <PasscodePad onSuccess={() => undefined} submitLabel="Sign In" />
      </div>
    </div>
  );
}

/**
 * Re-auth prompt shown when a scan resolves but the shift session has lapsed.
 * On success the caller continues to the target it already resolved.
 */
export function PasscodePrompt({
  isOpen,
  onClose,
  onSuccess,
  targetLabel
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetLabel?: string | null;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm">Session expired</h2>
              <p className="text-[11px] text-slate-400 truncate">
                {targetLabel ? `Re-enter your code to open ${targetLabel}` : 'Re-enter your code to continue'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="p-1.5 shrink-0 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <PasscodePad onSuccess={onSuccess} submitLabel="Unlock & Continue" />
        </div>
      </div>
    </div>
  );
}
