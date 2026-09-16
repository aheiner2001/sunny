'use client';
import React, { useState } from 'react';
import { Camera, Check, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { MAX_DAMAGE_PHOTOS, SIDE_LABEL, VEHICLE_SIDES } from '@/lib/vehicleDamage';
import type { User, VehicleDamageEvent, VehicleSide } from '@/types';

function processImageFile(file: File, callback: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 800;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
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

type Props = {
  vehicleId: string;
  user: Pick<User, 'id' | 'name'>;
  onRecorded?: (event: VehicleDamageEvent) => void;
};

export function VehicleDamageCapture({ vehicleId, user, onRecorded }: Props) {
  const [noNewDamage, setNoNewDamage] = useState(false);
  const [side, setSide] = useState<VehicleSide | ''>('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    if (!side && !noNewDamage) {
      setError('Pick Front, Rear, Left, Right, or Cab before adding photos.');
      return;
    }
    const remaining = MAX_DAMAGE_PHOTOS - photos.length;
    Array.from(files)
      .slice(0, remaining)
      .forEach((file) => {
        processImageFile(file, (dataUrl) => {
          setPhotos((prev) =>
            prev.length >= MAX_DAMAGE_PHOTOS ? prev : [...prev, dataUrl]
          );
        });
      });
  };

  const handleRecord = async () => {
    setError(null);
    setBusy(true);
    try {
      const event = await dbService.addVehicleDamageEvent({
        vehicleId,
        side: noNewDamage ? null : (side as VehicleSide) || null,
        noNewDamage,
        note: note.trim() || undefined,
        photoDataUrls: noNewDamage ? [] : photos,
        userId: user.id,
        userName: user.name,
      });
      setSaved(true);
      setNote('');
      setPhotos([]);
      onRecorded?.(event);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save damage entry.');
    } finally {
      setBusy(false);
    }
  };

  const sideName = side ? SIDE_LABEL[side] : null;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-alt/40 p-3">
      <div className="spread items-center">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Exterior / cab damage</h3>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-bold text-ink cursor-pointer">
        <input
          type="checkbox"
          checked={noNewDamage}
          onChange={(e) => {
            setNoNewDamage(e.target.checked);
            setSaved(false);
            setError(null);
          }}
          className="w-4 h-4 rounded border-slate-300"
        />
        No new damage
      </label>

      {!noNewDamage && (
        <>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
              Which side are these photos for?
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {VEHICLE_SIDES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSide(s);
                    setPhotos([]);
                    setSaved(false);
                    setError(null);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    side === s
                      ? 'bg-ink text-white border-ink'
                      : 'bg-surface border-line text-ink-muted hover:bg-surface-alt'
                  }`}
                >
                  {SIDE_LABEL[s]}
                </button>
              ))}
            </div>
            {sideName && (
              <p className="mt-2 text-xs font-semibold text-ink">
                Adding photos for <span className="underline decoration-2 underline-offset-2">{sideName}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setSaved(false);
              }}
              placeholder="Scratches near handleâ€¦"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-ink/20"
            />
          </div>

          <div className="space-y-2">
            <label
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                side
                  ? 'cursor-pointer border-line bg-surface text-ink hover:bg-surface-alt'
                  : 'cursor-not-allowed border-line bg-surface-sunk text-ink-faint'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>
                {sideName
                  ? `Add ${sideName} photos (${photos.length}/${MAX_DAMAGE_PHOTOS})`
                  : 'Pick a side first'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                disabled={!side || photos.length >= MAX_DAMAGE_PHOTOS}
                onChange={(e) => {
                  addFiles(e.target.files);
                  setSaved(false);
                  e.target.value = '';
                }}
              />
            </label>
            {photos.length > 0 && sideName && (
              <div className="flex flex-wrap gap-2">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={url}
                      alt={`${sideName} damage ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-line"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-ink/70 text-white text-[9px] font-bold text-center py-0.5 rounded-b-lg">
                      {sideName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotos((prev) => prev.filter((_, i) => i !== idx));
                        setSaved(false);
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5"
                      aria-label="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs font-semibold text-[var(--critical)]">{error}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleRecord()}
        className="btn btn-secondary btn-sm w-full disabled:opacity-50"
      >
        {busy
          ? 'Savingâ€¦'
          : noNewDamage
            ? 'Record no new damage'
            : sideName
              ? `Save ${sideName} damage`
              : 'Save damage entry'}
      </button>
    </div>
  );
}
