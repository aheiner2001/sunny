'use client';

import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download, QrCode, Sparkles, ExternalLink } from 'lucide-react';
import { Vehicle } from '@/types';

export function QRCodeDisplay({ vehicle }: { vehicle: Vehicle }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const scanUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/inspect/${vehicle.id}`
    : `https://sunnyfleet.app/inspect/${vehicle.id}`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vehicle QR - ${vehicle.vehicleNumber}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
              @page { size: auto; margin: 15mm; }
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
              text-align: center; 
              padding: 40px 20px; 
              background: #fff;
            }
            .sticker { 
              border: 3px solid #0284c7; 
              border-radius: 28px; 
              padding: 36px 28px; 
              max-width: 380px; 
              margin: 0 auto; 
              box-shadow: 0 4px 20px rgba(0,0,0,0.06);
              background: #ffffff;
            }
            .brand-header {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              margin-bottom: 2px;
            }
            .brand { 
              font-size: 26px; 
              font-weight: 900; 
              color: #0f172a; 
              letter-spacing: -0.5px;
            }
            .dot {
              display: inline-block;
              width: 10px;
              height: 10px;
              background-color: #f59e0b;
              border-radius: 50%;
              margin-left: 2px;
            }
            .sub { 
              font-size: 11px; 
              font-weight: 800;
              text-transform: uppercase; 
              letter-spacing: 2px; 
              color: #64748b; 
              margin-bottom: 24px; 
            }
            .qr-container {
              background: #fff;
              padding: 16px;
              border-radius: 20px;
              display: inline-block;
              border: 2px solid #e2e8f0;
              margin-bottom: 20px;
            }
            .qr-container svg {
              display: block;
            }
            .van-num { 
              font-size: 36px; 
              font-weight: 900; 
              color: #0f172a; 
              margin: 0 0 4px 0; 
              line-height: 1.1;
            }
            .van-name { 
              font-size: 14px; 
              font-weight: 600;
              color: #475569; 
              margin-bottom: 12px; 
            }
            .plate-badge { 
              display: inline-block; 
              background: #f1f5f9; 
              color: #1e293b;
              padding: 6px 16px; 
              border-radius: 10px; 
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; 
              font-weight: 800; 
              font-size: 15px; 
              letter-spacing: 1px;
              border: 1px solid #cbd5e1;
              margin-bottom: 24px; 
            }
            .instruction-box { 
              font-size: 13px; 
              font-weight: 700; 
              color: #0369a1; 
              background: #e0f2fe; 
              padding: 12px 20px; 
              border-radius: 16px; 
              line-height: 1.4;
            }
            .url-sub {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 14px;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="sticker">
            <div class="brand-header">
              <span class="brand">Sunny Fleet<span class="dot"></span></span>
            </div>
            <div class="sub">Vehicle Accountability System</div>
            <div class="qr-container">${qrRef.current?.innerHTML || ''}</div>
            <div class="van-num">${vehicle.vehicleNumber}</div>
            <div class="van-name">${vehicle.name}</div>
            <div><span class="plate-badge">${vehicle.licensePlate}</span></div>
            <div class="instruction-box">
              📱 Point phone camera at QR code<br/>to start daily inspection
            </div>
            <div class="url-sub">${scanUrl}</div>
          </div>
          <script>
            window.onload = function() { 
              setTimeout(function() {
                window.print(); 
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPNG = () => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // High resolution canvas for sharp printing
    canvas.width = 1000;
    canvas.height = 1000;

    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 100, 100, 800, 800);
      
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${vehicle.vehicleNumber.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
          <QrCode className="w-4 h-4" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Vehicle QR Sticker Badge</h3>
      </div>

      {/* Scannable SVG element */}
      <div 
        ref={qrRef} 
        className="p-4 bg-white rounded-3xl border-2 border-slate-200 shadow-inner flex items-center justify-center mb-4 transition-transform hover:scale-105"
      >
        <QRCodeSVG
          value={scanUrl}
          size={200}
          level="H"
          includeMargin={true}
        />
      </div>

      <div className="mb-4">
        <div className="text-lg font-black text-slate-900">{vehicle.vehicleNumber}</div>
        <div className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-3 py-1 rounded-md border border-sky-200/60 inline-block mt-1">
          {vehicle.licensePlate}
        </div>
        <p className="text-[11px] text-slate-400 mt-2 max-w-xs break-all">
          Scans to: <span className="font-semibold text-slate-600">{scanUrl}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xs">
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 text-xs font-bold shadow-md shadow-sky-600/20 transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Print Sticker</span>
        </button>

        <button
          onClick={handleDownloadPNG}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Save PNG</span>
        </button>
      </div>
    </div>
  );
}
