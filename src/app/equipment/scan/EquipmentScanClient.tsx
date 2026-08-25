'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, CheckCircle2, Package, Trash2, X } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Equipment, Vehicle } from '@/types';

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
      // Keep the chosen source across refreshes while it still holds stock,
      // otherwise marking usage would bounce the picker back to shop each time.
      setSourceVehicleId(prev =>
        prev && found.assignments?.some(a => a.vehicleId === prev)
          ? prev
          : found.kind === 'consumable' ? '' : current
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
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 } },
          async (code: string) => {
            await stopScanner();
            const parsed = code.includes('?id=') ? code.split('?id=')[1].split('&')[0] : code;
            router.replace(`/equipment/scan?id=${encodeURIComponent(parsed)}`);
          }, () => undefined);
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
  const currentAssignment = sourceVehicleId ? assignments.find(a => a.vehicleId === sourceVehicleId) : undefined;
  const sourceAvailable = sourceVehicleId ? currentAssignment?.quantity || 0 : available;
  const isReusable = equipment?.kind !== 'consumable';
  // Consumption comes out of the selected source: a truck's allocation, or shop.
  const consumeFrom = assignments.find(a => a.vehicleId === sourceVehicleId);
  const consumeAvailable = sourceVehicleId ? consumeFrom?.quantity || 0 : available;

  const markUsed = async (amount: number) => {
    if (!equipment) return;
    if (!Number.isInteger(amount) || amount <= 0) return setError('Enter how many were used.');
    if (amount > consumeAvailable) return setError(`Only ${consumeAvailable} available there.`);
    const where = sourceVehicleId
      ? vehicles.find(v => v.id === sourceVehicleId)?.vehicleNumber || 'that vehicle'
      : 'shop stock';
    if (!window.confirm(`Mark ${amount} x ${equipment.name} as used up on ${where}? This removes it from fleet inventory.`)) {
      return;
    }
    try {
      const updated = await dbService.consumeEquipmentQuantity(equipment.id, sourceVehicleId || null, amount);
      setEquipment(updated);
      setError('');
      setUsedQuantity('1');
      if (sourceVehicleId && !updated.assignments?.some(a => a.vehicleId === sourceVehicleId)) {
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
          : `${equipment.name} transferred to ${vehicles.find(v => v.id === targetVehicleId)?.vehicleNumber}.`
      );
      router.push('/equipment');
    } catch (err: any) {
      setError(err.message || 'Could not complete transfer.');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <Link href="/equipment" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600">
        <ArrowLeft className="w-4 h-4" /> Equipment Inventory
      </Link>
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center"><Package className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-extrabold">Equipment QR Scan</h1><p className="text-xs text-slate-500">Review the transfer, then explicitly confirm or cancel.</p></div>
        </div>
        <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden mb-4"><div id={scannerContainerId} className="w-full h-full" />{cameraError && <p className="absolute inset-0 flex items-center justify-center p-5 text-center text-xs text-slate-300">{cameraError}</p>}</div>
        <form className="flex gap-2 mb-5" onSubmit={e => { e.preventDefault(); resolve(manualCode.trim()); }}>
          <input value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder="Equipment QR token or ID" className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs" />
          <button className="px-4 rounded-xl bg-slate-900 text-white text-xs font-bold">Find</button>
        </form>
        {error && <div className="mb-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 p-3 text-xs font-semibold">{error}</div>}
        {equipment && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex justify-between gap-3"><div><h2 className="font-extrabold text-slate-900">{equipment.name}</h2><p className="text-[11px] text-slate-500">{isReusable ? 'Reusable equipment' : 'Consumable stock'}</p></div><div className="text-right"><div className="text-lg font-black text-sky-700">{available}</div><div className="text-[10px] text-slate-500">available</div></div></div>
              {assignments.length > 0 && <p className="text-[11px] text-slate-500 mt-2">Assigned: {assignments.map(a => `${a.vehicleNumber} (${a.quantity})`).join(', ')}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-700">Take quantity<input type="number" min="1" step="1" max={sourceAvailable} value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200" /></label>
              {assignments.length > 0 && <label className="text-xs font-bold text-slate-700">Take from<select value={sourceVehicleId} onChange={e => setSourceVehicleId(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200"><option value="">Shared / unassigned stock ({available})</option>{assignments.map(a => <option key={a.vehicleId} value={a.vehicleId}>{a.vehicleNumber} ({a.quantity})</option>)}</select></label>}
              <label className="text-xs font-bold text-slate-700">Receiving location<select value={targetVehicleId} onChange={e => setTargetVehicleId(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200"><option value="">Choose location...</option><option value="__shop__">In Shop / Unassigned</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select></label>
            </div>
            {/* Consumables only: record stock that has been used up. */}
            {!isReusable && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="w-4 h-4 text-amber-700 shrink-0" />
                  <h3 className="text-xs font-extrabold text-amber-900">Mark stock as used</h3>
                </div>
                <p className="text-[11px] text-amber-800/90 mb-3">
                  Removes it from {sourceVehicleId ? vehicles.find(v => v.id === sourceVehicleId)?.vehicleNumber || 'the vehicle' : 'shop stock'} and
                  from the fleet total. {consumeAvailable} available there.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-[11px] font-bold text-amber-900">
                    Quantity used
                    <input
                      type="number"
                      min="1"
                      step="1"
                      max={consumeAvailable}
                      value={usedQuantity}
                      onChange={e => setUsedQuantity(e.target.value)}
                      className="mt-1 w-24 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={consumeAvailable === 0}
                    onClick={() => markUsed(Number(usedQuantity))}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Mark used
                  </button>
                  {consumeAvailable > 1 && (
                    <button
                      type="button"
                      onClick={() => markUsed(consumeAvailable)}
                      className="px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors"
                    >
                      Used it all ({consumeAvailable})
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => router.push('/equipment')} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"><X className="w-4 h-4 inline mr-1" />Cancel</button>
              <button type="button" onClick={confirm} className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold"><CheckCircle2 className="w-4 h-4 inline mr-1" />Confirm transfer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
