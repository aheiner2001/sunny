'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Sparkles,
  ArrowLeft,
  Truck,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
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
          () => {},
        );
      } catch {
        if (isMounted) {
          setCameraError('Camera stream unavailable or permission needed. Use 1-tap quick select below.');
        }
      }
    }

    const timer = setTimeout(() => {
      void initCamera();
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
        } catch {
          // ignore teardown errors
        }
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

    if (!isSessionValid()) {
      setPendingVehicle(vehicle);
      return;
    }

    openVehicle(vehicle);
  };

  const openVehicle = (vehicle: Vehicle) => {
    const activeRole = dbService.getSession()?.role || roleRef.current;
    const mode = activeRole === 'manager' ? '' : '&mode=employee';
    router.push(`/inspect?id=${encodeURIComponent(vehicle.id)}${mode}`);
  };

  return (
    <div className="page max-w-xl mx-auto">
      <div className="spread">
        <Link href="/dashboard" className="btn btn-secondary btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Dashboard
        </Link>
        <span className="badge" data-status="info">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {role === 'manager' ? 'Manager Scan Active' : 'Employee Inspection Flow'}
        </span>
      </div>

      <div className="card card-pad text-center">
        <span className="icon-tile icon-tile-lg mx-auto mb-3 bg-ink text-ink-inverse" aria-hidden>
          <Camera className="h-6 w-6" />
        </span>
        <h1 className="card-title text-xl">Scan Vehicle QR Code</h1>
        <p className="text-sm text-ink-muted max-w-sm mx-auto mt-1 mb-6">
          Hold your phone camera up to the QR code sticker on the vehicle door or dashboard to instantly load its inspection checklist.
        </p>

        <div className="relative w-full max-w-xs mx-auto aspect-square rounded-[var(--radius-lg)] overflow-hidden bg-ink border-4 border-ink shadow-inner flex items-center justify-center">
          <div id="camera-stream-container" className="w-full h-full text-ink-inverse" />

          {cameraError && (
            <div className="absolute inset-0 bg-ink/95 p-6 flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-10 w-10 text-hivis mb-2" aria-hidden />
              <p className="text-xs text-ink-inverse/80 mb-3">{cameraError}</p>
              <p className="text-2xs font-bold text-hivis">Select any vehicle below to test instantly!</p>
            </div>
          )}

          <div className="absolute inset-8 pointer-events-none border-2 border-hivis/60 rounded-[var(--radius-lg)] animate-pulse flex items-center justify-center">
            <span className="text-2xs font-bold tracking-widest text-hivis uppercase bg-ink/60 px-2 py-0.5 rounded">
              Align QR Code
            </span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-line text-left">
          <div className="spread mb-3">
            <span className="eyebrow mb-0 cluster">
              <Sparkles className="h-3.5 w-3.5 text-hivis" aria-hidden />
              Quick Test Selector (No camera required)
            </span>
            <span className="hint">1-Click Inspection</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {vehicles.slice(0, 6).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleDecoded(v.id)}
                className="card card-pad flex items-center justify-between text-left hover:border-line-strong transition-all group"
              >
                <div className="cluster">
                  <span className="icon-tile" data-status="info" aria-hidden>
                    <Truck className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold">{v.vehicleNumber}</div>
                    <div className="text-2xs text-ink-faint">{v.name.split('-')[0]}</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-ink-faint group-hover:text-ink transition-transform group-hover:translate-x-1" aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) handleDecoded(manualCode.trim());
          }}
          className="mt-6 pt-6 border-t border-line cluster"
        >
          <input
            type="text"
            placeholder="Manual vehicle token (e.g. van-1, van-2)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="input flex-1"
          />
          <button type="submit" className="btn btn-primary">
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
