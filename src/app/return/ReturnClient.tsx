'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Camera, CheckCircle2, Truck, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import {
  normalizeReturnQuestions,
  resolveReturnVehicle,
  vehiclesInUse,
} from '@/lib/returnFlow';
import { canSubmitInspection } from '../inspect/inspectionValidation';
import type {
  ChecklistQuestion,
  InspectionResponse,
  MissedReturn,
  Vehicle,
} from '@/types';

type ResponseDraft = {
  value: string;
  isFlagged: boolean;
  notes?: string;
  photoUrl?: string;
};

function processImageFile(file: File, callback: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        callback(e.target?.result as string);
      }
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

export default function ReturnClient() {
  const { user, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const missedId = searchParams?.get('missed') || '';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [missed, setMissed] = useState<MissedReturn | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnedVehicle, setReturnedVehicle] = useState<string | null>(null);

  const load = () => {
    const fleet = dbService.getVehicles();
    setVehicles(fleet);
    const config = dbService.getChecklistConfig();
    setQuestions(normalizeReturnQuestions(config.returnQuestions));
    if (missedId) {
      const row = dbService.getMissedReturns().find((m) => m.id === missedId) || null;
      setMissed(row && row.status === 'pending' ? row : row);
    } else {
      setMissed(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    window.addEventListener('sunny_db_update', load);
    return () => window.removeEventListener('sunny_db_update', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missedId]);

  const resolved = useMemo(
    () =>
      resolveReturnVehicle({
        userId: user?.id,
        vehicles,
        missed: missed ? { vehicleId: missed.vehicleId } : null,
      }),
    [user?.id, vehicles, missed]
  );

  const inUse = useMemo(() => vehiclesInUse(vehicles), [vehicles]);
  const vehicle =
    resolved || vehicles.find((v) => v.id === pickedId) || null;

  const isCatchUp = Boolean(missed && missed.status === 'pending');

  const setResponse = (
    q: ChecklistQuestion,
    value: string,
    isFlagged: boolean,
    photoUrl?: string
  ) => {
    setResponses((prev) => ({
      ...prev,
      [q.id]: {
        value,
        isFlagged,
        photoUrl: photoUrl !== undefined ? photoUrl : prev[q.id]?.photoUrl,
      },
    }));
  };

  const allRequiredAnswered = canSubmitInspection(questions, responses);

  const deferCatchUp = () => {
    if (user) {
      try {
        sessionStorage.setItem(`sunny_return_defer_${user.id}`, '1');
      } catch {
        /* ignore */
      }
    }
    router.replace('/home');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !vehicle || !allRequiredAnswered || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: InspectionResponse[] = questions.map((q) => {
        const resp = responses[q.id];
        return {
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'general',
          value: resp?.value ?? '',
          isFlagged: Boolean(resp?.isFlagged),
          notes: resp?.notes,
          photoUrl: resp?.photoUrl,
        };
      });
      dbService.submitReturnInspection({
        vehicleId: vehicle.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email || '',
        responses: payload,
        missedReturnId: missed?.id || null,
      });
      setReturnedVehicle(vehicle.vehicleNumber);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not submit return.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (returnedVehicle) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="card card-pad text-center space-y-3" data-status="ok">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[var(--ok)]" />
          <h1 className="card-title">Returned — {returnedVehicle} available.</h1>
          <p className="hint">Occupancy is cleared. The van is ready for the next driver.</p>
          <div className="cluster justify-center pt-2">
            <Link href="/home" className="btn btn-primary btn-sm">
              Home
            </Link>
            <Link href="/vehicles" className="btn btn-secondary btn-sm">
              Vehicles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <h1 className="card-title">Return a van</h1>
        {isCatchUp && missed && (
          <p className="text-sm font-semibold text-amber-800">
            You forgot to sign out of {missed.vehicleNumber}.
          </p>
        )}
        <p className="hint">
          {user
            ? 'No van is checked out to you. Pick one that is in use, or scan a vehicle QR.'
            : 'Sign in, then return the van you drove.'}
        </p>
        {inUse.length > 0 ? (
          <div className="stack-tight">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">In use</p>
            {inUse.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setPickedId(v.id)}
                className="card card-pad text-left hover:bg-[var(--surface-alt)]"
              >
                <div className="cluster">
                  <span className="icon-tile" data-status="info" aria-hidden>
                    <Truck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-bold text-sm">{v.vehicleNumber}</div>
                    <p className="text-xs text-ink-muted">
                      {v.currentUserName || 'Driver'} · {v.name}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="card card-pad">
            <p className="text-sm">No vans are currently in use.</p>
          </div>
        )}
        <Link href="/scan" className="btn btn-secondary btn-sm">
          Open scanner
        </Link>
        {isCatchUp && (
          <button type="button" onClick={deferCatchUp} className="btn btn-ghost btn-sm">
            Remind me later
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <div>
        <p className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Shop exit</p>
        <h1 className="card-title mt-1">Return {vehicle.vehicleNumber}</h1>
        <p className="hint">{vehicle.name}</p>
      </div>

      {isCatchUp && (
        <div className="card card-pad cluster items-start gap-2" data-status="flagged">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold">
              You forgot to sign out of {missed?.vehicleNumber || vehicle.vehicleNumber}.
            </p>
            <p className="hint mt-0.5">
              Complete this short checklist to catch up. Occupancy was already cleared overnight.
            </p>
            <button type="button" onClick={deferCatchUp} className="btn btn-ghost btn-sm mt-2">
              Remind me later
            </button>
          </div>
        </div>
      )}

      {role === 'manager' && isCatchUp && (
        <button type="button" onClick={() => router.replace('/home')} className="btn btn-ghost btn-sm">
          Dismiss
        </button>
      )}

      <form onSubmit={handleSubmit} className="card card-pad space-y-4">
        {questions.map((q) => {
          const resp = responses[q.id];
          const isFlagged = Boolean(resp?.isFlagged);
          return (
            <div key={q.id} className="border-b border-line last:border-b-0 pb-4 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-ink">
                  {q.text}
                  {q.required ? <span className="text-[var(--critical)]"> *</span> : null}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {q.type === 'pass_fail' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setResponse(q, 'pass', false)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          resp?.value === 'pass' && !isFlagged
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => setResponse(q, 'fail', true)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          isFlagged
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-surface border border-line text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        Fail
                      </button>
                    </>
                  )}
                  {(q.type === 'yes_no' || !q.type) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setResponse(q, 'yes', false)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          resp?.value === 'yes'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setResponse(q, 'no', false)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          resp?.value === 'no'
                            ? 'bg-ink text-white shadow-sm'
                            : 'bg-surface border border-line text-ink-muted hover:bg-surface-alt'
                        }`}
                      >
                        No
                      </button>
                    </>
                  )}
                </div>
              </div>
              {q.helperText && <p className="text-[11px] text-ink-faint mt-1">{q.helperText}</p>}
              {q.type === 'text' && (
                <input
                  type="text"
                  placeholder="Type a note..."
                  value={resp?.value || ''}
                  onChange={(e) => setResponse(q, e.target.value, false)}
                  className="mt-2 w-full px-3 py-1.5 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-ink/20"
                />
              )}
              {q.type === 'photo' && (
                <div className="mt-2 space-y-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-surface-alt">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{resp?.photoUrl ? 'Change photo' : 'Take / attach photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          processImageFile(file, (dataUrl) => {
                            setResponse(q, 'captured', false, dataUrl);
                          });
                        }
                      }}
                    />
                  </label>
                  {resp?.photoUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => setResponse(q, '', false, '')}
                        className="text-xs text-[var(--critical)] hover:underline inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Remove photo
                      </button>
                      <img
                        src={resp.photoUrl}
                        alt="Captured answer"
                        className="w-28 h-28 object-cover rounded-xl border border-line"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {error && (
          <p className="text-xs font-semibold text-[var(--critical)]">{error}</p>
        )}

        <button
          type="submit"
          disabled={!allRequiredAnswered || isSubmitting}
          className="btn btn-primary btn-block disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit return'}
        </button>
      </form>
    </div>
  );
}
