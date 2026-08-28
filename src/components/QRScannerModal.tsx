'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
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
  const [manualInput, setManualInput] = useState('');
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
      void stopScanner();
      return;
    }

    let isMounted = true;

    async function startScanner() {
      try {
        setCameraError(null);
        const { Html5Qrcode } = await import('html5-qrcode');

        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText: string) => {
            handleCodeFound(decodedText);
          },
          () => {},
        );
      } catch (err: any) {
        console.warn('Camera start issue:', err);
        if (isMounted) {
          setCameraError(
            'Camera permission needed or camera unavailable in current browser. You can select a vehicle below to test instantly!',
          );
        }
      }
    }

    const timer = setTimeout(() => {
      void startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      void stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
  };

  const handleCodeFound = (scannedText: string) => {
    void stopScanner();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="card-head bg-ink text-ink-inverse">
          <div className="cluster">
            <span className="icon-tile bg-hivis text-ink" aria-hidden>
              <Camera className="h-4 w-4" />
            </span>
            <div>
              <h2 className="card-title text-ink-inverse">Scan Vehicle QR</h2>
              <p className="text-2xs text-ink-faint">Point at van sticker to start</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void stopScanner();
              onClose();
            }}
            className="btn btn-ghost btn-sm text-ink-faint hover:text-ink-inverse"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="card-pad stack overflow-y-auto flex-1">
          <div className="relative bg-ink rounded-[var(--radius-lg)] overflow-hidden min-h-[260px] flex items-center justify-center border-2 border-ink shadow-inner">
            <div id={scannerContainerId} className="w-full h-full text-ink-inverse" />

            {cameraError && (
              <div className="absolute inset-0 bg-ink/90 p-6 flex flex-col items-center justify-center text-center">
                <AlertCircle className="h-10 w-10 text-hivis mb-2" aria-hidden />
                <p className="text-xs text-ink-inverse/80 mb-4">{cameraError}</p>
                <div className="text-2xs font-semibold text-hivis">
                  Select a test van below to start inspection:
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="spread mb-2">
              <span className="eyebrow mb-0 cluster">
                <Sparkles className="h-3.5 w-3.5 text-hivis" aria-hidden />
                Quick Select (Testing Mode)
              </span>
              <span className="hint">1-click auto-scan</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {vehicles.slice(0, 4).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleCodeFound(v.id)}
                  className="card card-pad flex items-center justify-between text-left hover:border-line-strong transition-all group"
                >
                  <div>
                    <div className="text-xs font-bold group-hover:text-ink">{v.vehicleNumber}</div>
                    <div className="text-2xs text-ink-faint truncate max-w-[120px]">{v.name.split('-')[0]}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-ink transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="cluster pt-2 border-t border-line">
            <input
              type="text"
              placeholder="Or enter vehicle ID (e.g. van-1)"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="input flex-1"
            />
            <button type="submit" className="btn btn-primary">
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
