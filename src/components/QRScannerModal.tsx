'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, RefreshCw, Sparkles, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { dbService } from '@/lib/db';
import { Vehicle } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PasscodePrompt } from '@/components/PasscodeGate';

export function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (vehicle: Vehicle) => void;
}) {
  const router = useRouter();
  const { role, isSessionValid } = useAuth();
  const roleRef = useRef(role);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  // Vehicle resolved from a scan that is waiting on a fresh passcode.
  const [pendingVehicle, setPendingVehicle] = useState<Vehicle | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'qr-reader-container';

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    setVehicles(dbService.getVehicles());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    async function startScanner() {
      try {
        setCameraError(null);
        setIsScanning(true);
        const { Html5Qrcode } = await import('html5-qrcode');

        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText: string) => {
            handleCodeFound(decodedText);
          },
          () => {
            // scan error per frame, ignore
          }
        );
      } catch (err: any) {
        console.warn('Camera start issue:', err);
        if (isMounted) {
          setCameraError(
            'Camera permission needed or camera unavailable in current browser. You can select a vehicle below to test instantly!'
          );
          setIsScanning(false);
        }
      }
    }

    // Short timeout to ensure DOM container is rendered
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
  };

  const handleCodeFound = (scannedText: string) => {
    stopScanner();
    // Parse vehicle from code/url
    let token = scannedText;
    if (scannedText.includes('/inspect?id=')) {
      token = scannedText.split('/inspect?id=')[1]?.split('&')[0] || scannedText;
    } else if (scannedText.includes('?inspect=')) {
      token = scannedText.split('?inspect=')[1]?.split('&')[0] || scannedText;
    } else if (scannedText.includes('/inspect/')) {
      token = scannedText.split('/inspect/')[1]?.split('?')[0] || scannedText;
    } else if (scannedText.includes('sunny://vehicle/')) {
      token = scannedText.replace('sunny://vehicle/', '');
    }

    const vehicle = dbService.getVehicleByQR(token) || dbService.getVehicle(token);
    if (!vehicle) {
      alert(`Vehicle with code "${scannedText}" not found in fleet.`);
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
    if (onScanSuccess) {
      onScanSuccess(vehicle);
    } else {
      // Read the role from the live session: after a re-auth the context role
      // has not propagated to roleRef yet.
      const activeRole = dbService.getSession()?.role || roleRef.current;
      const mode = activeRole === 'manager' ? '' : '&mode=employee';
      router.push(`/inspect?id=${encodeURIComponent(vehicle.id)}${mode}`);
    }
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleCodeFound(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200/80 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base">Scan Vehicle QR</h2>
              <p className="text-[11px] text-slate-400">Point at van sticker to start</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Camera Viewport Container */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center border-2 border-slate-800 shadow-inner">
            <div id={scannerContainerId} className="w-full h-full text-white" />

            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 p-6 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 mb-4">{cameraError}</p>
                <div className="text-[11px] font-semibold text-sky-400">
                  Select a test van below to start inspection:
                </div>
              </div>
            )}
          </div>

          {/* Quick Select / Direct Test Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Select (Testing Mode)
              </span>
              <span className="text-[11px] text-slate-400">1-click auto-scan</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {vehicles.slice(0, 4).map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleCodeFound(v.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-left transition-all group"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700">
                      {v.vehicleNumber}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                      {v.name.split('-')[0]}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Manual Token Search */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="Or enter vehicle ID (e.g. van-1)"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Go
            </button>
          </form>
        </div>
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
