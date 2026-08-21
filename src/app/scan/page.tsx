'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Camera, 
  QrCode, 
  Sparkles, 
  ArrowLeft, 
  Truck, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { dbService } from '@/lib/db';
import { Vehicle } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PasscodePrompt } from '@/components/PasscodeGate';

export default function ScanPage() {
  const router = useRouter();
  const { role, isSessionValid } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  // Vehicle resolved from a scan that is waiting on a fresh passcode.
  const [pendingVehicle, setPendingVehicle] = useState<Vehicle | null>(null);
  const scannerRef = useRef<any>(null);
  const roleRef = useRef(role);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    setVehicles(dbService.getVehicles());
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode('camera-stream-container');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (text: string) => {
            handleDecoded(text);
          },
          () => {}
        );
      } catch (err: any) {
        if (isMounted) {
          setCameraError('Camera stream unavailable or permission needed. Use 1-tap quick select below.');
        }
      }
    }

    const timer = setTimeout(() => {
      initCamera();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {}
      }
    };
  }, []);

  const handleDecoded = (rawCode: string) => {
    let token = rawCode;
    if (rawCode.includes('/inspect?id=')) {
      token = rawCode.split('/inspect?id=')[1]?.split('&')[0] || rawCode;
    } else if (rawCode.includes('?inspect=')) {
      token = rawCode.split('?inspect=')[1]?.split('&')[0] || rawCode;
    } else if (rawCode.includes('/inspect/')) {
      token = rawCode.split('/inspect/')[1]?.split('?')[0] || rawCode;
    } else if (rawCode.includes('sunny://vehicle/')) {
      token = rawCode.replace('sunny://vehicle/', '');
    }

    const vehicle = dbService.getVehicleByQR(token) || dbService.getVehicle(token);
    if (!vehicle) {
      alert(`Vehicle with QR token "${rawCode}" was not found.`);
      return;
    }

    // Active shift session: straight into the inspection. Lapsed: ask for the
    // passcode first, then continue to the vehicle we already resolved.
    if (!isSessionValid()) {
      setPendingVehicle(vehicle);
      return;
    }

    openVehicle(vehicle);
  };

  const openVehicle = (vehicle: Vehicle) => {
    // Read the role from the live session: after a re-auth the context role
    // has not propagated to roleRef yet.
    const activeRole = dbService.getSession()?.role || roleRef.current;
    const mode = activeRole === 'manager' ? '' : '&mode=employee';
    router.push(`/inspect?id=${encodeURIComponent(vehicle.id)}${mode}`);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
          <ShieldCheck className="w-4 h-4" />
          <span>{role === 'manager' ? 'Manager Scan Active' : 'Employee Inspection Flow'}</span>
        </div>
      </div>

      {/* Main Scan Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white mx-auto flex items-center justify-center mb-3 shadow-md shadow-sky-600/30">
          <Camera className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">Scan Vehicle QR Code</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
          Hold your phone camera up to the QR code sticker on the vehicle door or dashboard to instantly load its inspection checklist.
        </p>

        {/* Camera Viewfinder */}
        <div className="relative w-full max-w-xs mx-auto aspect-square rounded-3xl overflow-hidden bg-slate-950 border-4 border-slate-900 shadow-inner flex items-center justify-center">
          <div id="camera-stream-container" className="w-full h-full text-white" />

          {cameraError && (
            <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-xs text-slate-300 mb-3">{cameraError}</p>
              <p className="text-[11px] font-bold text-sky-400">Select any vehicle below to test instantly!</p>
            </div>
          )}

          {/* Reticle guide overlay */}
          <div className="absolute inset-8 pointer-events-none border-2 border-sky-400/60 rounded-2xl animate-pulse flex items-center justify-center">
            <span className="text-[10px] font-bold tracking-widest text-sky-300 uppercase bg-slate-900/60 px-2 py-0.5 rounded">
              Align QR Code
            </span>
          </div>
        </div>

        {/* Quick Test Van Picker */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-left">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick Test Selector (No camera required)
            </span>
            <span className="text-[11px] text-slate-400 font-medium">1-Click Inspection</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {vehicles.slice(0, 6).map((v) => (
              <button
                key={v.id}
                onClick={() => handleDecoded(v.id)}
                className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-sky-50 hover:border-sky-300 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs group-hover:text-sky-600 group-hover:border-sky-300 shadow-sm">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700">
                      {v.vehicleNumber}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {v.name.split('-')[0]}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Manual Code Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) handleDecoded(manualCode.trim());
          }}
          className="mt-6 pt-6 border-t border-slate-100 flex gap-2"
        >
          <input
            type="text"
            placeholder="Manual vehicle token (e.g. van-1, van-2)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Start
          </button>
        </form>
      </div>

      <PasscodePrompt
        isOpen={pendingVehicle !== null}
        targetLabel={pendingVehicle ? `${pendingVehicle.vehicleNumber} inspection` : null}
        onClose={() => setPendingVehicle(null)}
        onSuccess={() => {
          const target = pendingVehicle;
          setPendingVehicle(null);
          if (target) openVehicle(target);
        }}
      />
    </div>
  );
}
