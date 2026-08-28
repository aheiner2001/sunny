'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, CheckCircle2, Package, Trash2, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, Vehicle } from '@/types';
import { PageHeader } from '@/components/PageHeader';

export default function EquipmentScanClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params?.get('id') || params?.get('equipment') || params?.get('q') || '';
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [usedQuantity, setUsedQuantity] = useState('1');
  const [targetVehicleId, setTargetVehicleId] = useState('');
  const [sourceVehicleId, setSourceVehicleId] = useState('');
  const [manualCode, setManualCode] = useState(token);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'equipment-camera';

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Ignore stop race conditions during route changes or fast rescans.
    }
    try {
      scanner.clear();
    } catch {
      // Ignore teardown errors from already disposed scanners.
    }
  };

  const resolve = async (value: string) => {
    const found = dbService.getEquipmentByQR(value) || dbService.getEquipmentItem(value) || await dbService.fetchEquipmentAsync(value);
    setEquipment(found || null);
    setError(found ? '' : `Equipment code "${value}" was not found.`);
    if (found) {
      const current = found.assignments?.[0]?.vehicleId || found.vehicleId || '';
      setSourceVehicleId((prev) =>
        prev && found.assignments?.some((a) => a.vehicleId === prev)
          ? prev
          : found.kind === 'consumable' ? '' : current,
      );
      setQuantity('1');
    }
  };

  useEffect(() => {
    setVehicles(dbService.getVehicles());
    if (token) void resolve(token);
    const refresh = () => {
      setVehicles(dbService.getVehicles());
      if (token) void resolve(token);
    };
    window.addEventListener('sunny_db_update', refresh);
    return () => window.removeEventListener('sunny_db_update', refresh);
  }, [token]);

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;
        const scanner = new Html5Qrcode(scannerContainerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (code: string) => {
            await stopScanner();
            const parsed = code.includes('?id=') ? code.split('?id=')[1].split('&')[0] : code;
            router.replace(`/equipment/scan?id=${encodeURIComponent(parsed)}`);
          },
          () => undefined,
        );
      } catch {
        if (mounted) setCameraError('Camera unavailable. Enter the equipment QR token below.');
      }
    };
    const timer = window.setTimeout(start, 150);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      void stopScanner();
    };
  }, [router]);

  const assignments = equipment?.assignments || [];
  const assigned = assignments.reduce((sum, item) => sum + item.quantity, 0);
  const available = equipment ? Math.max(0, equipment.availableQuantity ?? ((equipment.totalQuantity ?? 1) - assigned)) : 0;
  const currentAssignment = sourceVehicleId ? assignments.find((a) => a.vehicleId === sourceVehicleId) : undefined;
  const sourceAvailable = sourceVehicleId ? currentAssignment?.quantity || 0 : available;
  const isReusable = equipment?.kind !== 'consumable';
  const consumeFrom = assignments.find((a) => a.vehicleId === sourceVehicleId);
  const consumeAvailable = sourceVehicleId ? consumeFrom?.quantity || 0 : available;

  const markUsed = async (amount: number) => {
    if (!equipment) return;
    if (!Number.isInteger(amount) || amount <= 0) return setError('Enter how many were used.');
    if (amount > consumeAvailable) return setError(`Only ${consumeAvailable} available there.`);
    const where = sourceVehicleId
      ? vehicles.find((v) => v.id === sourceVehicleId)?.vehicleNumber || 'that vehicle'
      : 'shop stock';
    if (!window.confirm(`Mark ${amount} x ${equipment.name} as used up on ${where}? This removes it from fleet inventory.`)) {
      return;
    }
    try {
      const updated = await dbService.consumeEquipmentQuantity(equipment.id, sourceVehicleId || null, amount);
      setEquipment(updated);
      setError('');
      setUsedQuantity('1');
      if (sourceVehicleId && !updated.assignments?.some((a) => a.vehicleId === sourceVehicleId)) {
        setSourceVehicleId('');
      }
    } catch (err: any) {
      setError(err.message || 'Could not record usage.');
    }
  };

  const confirm = async () => {
    if (!equipment || !targetVehicleId) return setError('Choose a receiving location.');
    const returningToShop = targetVehicleId === '__shop__';
    if (returningToShop && !sourceVehicleId) return setError('Choose the vehicle returning this equipment.');
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0 || amount > sourceAvailable) {
      return setError(`Enter a whole number from 1 to ${sourceAvailable}.`);
    }
    if (isReusable && sourceVehicleId === targetVehicleId) return setError('Choose a different target vehicle.');
    try {
      if (returningToShop) {
        await dbService.returnEquipmentToShop(equipment.id, sourceVehicleId, amount);
      } else {
        await dbService.transferEquipmentQuantity(equipment.id, targetVehicleId, amount, sourceVehicleId || null);
      }
      setError('');
      alert(
        returningToShop
          ? `${equipment.name} returned to In Shop / Unassigned.`
          : `${equipment.name} transferred to ${vehicles.find((v) => v.id === targetVehicleId)?.vehicleNumber}.`,
      );
      router.push('/equipment');
    } catch (err: any) {
      setError(err.message || 'Could not complete transfer.');
    }
  };

  return (
    <div className="page max-w-xl mx-auto">
      <Link href="/equipment" className="btn btn-secondary btn-sm self-start">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Equipment Inventory
      </Link>

      <PageHeader
        title="Equipment QR Scan"
        subtitle="Review the transfer, then explicitly confirm or cancel."
      />

      <div className="card card-pad">
        <div className="relative aspect-video rounded-[var(--radius-lg)] bg-ink overflow-hidden mb-4">
          <div id={scannerContainerId} className="w-full h-full" />
          {cameraError && (
            <p className="absolute inset-0 flex items-center justify-center p-5 text-center text-xs text-ink-inverse/80">
              {cameraError}
            </p>
          )}
        </div>

        <form
          className="cluster mb-5"
          onSubmit={(e) => {
            e.preventDefault();
            void resolve(manualCode.trim());
          }}
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Equipment QR token or ID"
            className="input flex-1"
          />
          <button type="submit" className="btn btn-primary">
            Find
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-[var(--radius)] bg-[var(--critical-wash)] text-[var(--critical)] border border-[var(--critical)]/30 p-3 text-xs font-semibold">
            {error}
          </div>
        )}

        {equipment && (
          <div className="stack">
            <div className="card card-pad bg-[var(--surface-alt)]">
              <div className="spread gap-3">
                <div>
                  <h2 className="card-title">{equipment.name}</h2>
                  <p className="hint">{isReusable ? 'Reusable equipment' : 'Consumable stock'}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-ink">{available}</div>
                  <div className="text-2xs text-ink-faint">available</div>
                </div>
              </div>
              {assignments.length > 0 && (
                <p className="hint mt-2">
                  Assigned: {assignments.map((a) => `${a.vehicleNumber} (${a.quantity})`).join(', ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="field">
                <span className="label">Take quantity</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  max={sourceAvailable}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input"
                />
              </label>
              {assignments.length > 0 && (
                <label className="field">
                  <span className="label">Take from</span>
                  <select
                    value={sourceVehicleId}
                    onChange={(e) => setSourceVehicleId(e.target.value)}
                    className="select"
                  >
                    <option value="">Shared / unassigned stock ({available})</option>
                    {assignments.map((a) => (
                      <option key={a.vehicleId} value={a.vehicleId}>
                        {a.vehicleNumber} ({a.quantity})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field sm:col-span-2">
                <span className="label">Receiving location</span>
                <select
                  value={targetVehicleId}
                  onChange={(e) => setTargetVehicleId(e.target.value)}
                  className="select"
                >
                  <option value="">Choose location...</option>
                  <option value="__shop__">In Shop / Unassigned</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!isReusable && (
              <div className="card card-pad bg-[var(--hivis-wash)] border-[var(--hivis)]/40" data-status="flagged">
                <div className="cluster mb-1">
                  <Trash2 className="h-4 w-4 text-[var(--hivis-text)] shrink-0" aria-hidden />
                  <h3 className="text-xs font-extrabold text-[var(--hivis-text)]">Mark stock as used</h3>
                </div>
                <p className="hint mb-3">
                  Removes it from{' '}
                  {sourceVehicleId
                    ? vehicles.find((v) => v.id === sourceVehicleId)?.vehicleNumber || 'the vehicle'
                    : 'shop stock'}{' '}
                  and from the fleet total. {consumeAvailable} available there.
                </p>
                <div className="cluster items-end flex-wrap">
                  <label className="field">
                    <span className="label">Quantity used</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      max={consumeAvailable}
                      value={usedQuantity}
                      onChange={(e) => setUsedQuantity(e.target.value)}
                      className="input w-24"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={consumeAvailable === 0}
                    onClick={() => void markUsed(Number(usedQuantity))}
                    className="btn btn-attention btn-sm"
                  >
                    Mark used
                  </button>
                  {consumeAvailable > 1 && (
                    <button
                      type="button"
                      onClick={() => void markUsed(consumeAvailable)}
                      className="btn btn-secondary btn-sm"
                    >
                      Used it all ({consumeAvailable})
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="cluster pt-2 border-t border-line">
              <button type="button" onClick={() => router.push('/equipment')} className="btn btn-secondary flex-1">
                <X className="h-4 w-4" aria-hidden />
                Cancel
              </button>
              <button type="button" onClick={() => void confirm()} className="btn btn-primary flex-1">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Confirm transfer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
