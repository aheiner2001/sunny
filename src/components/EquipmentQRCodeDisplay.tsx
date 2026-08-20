'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { Download, Printer, QrCode } from 'lucide-react';
import { Equipment } from '@/types';

export function EquipmentQRCodeDisplay({ equipment }: { equipment: Equipment }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/sunny' : '');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aheiner2001.github.io';
  const token = equipment.qrCodeToken || equipment.qrCode;
  if (!token) {
    return <span className="text-[11px] text-slate-400">No QR code assigned</span>;
  }
  const scanUrl = `${origin}${basePath}/equipment/scan?id=${encodeURIComponent(token)}`;

  const handleDownloadPNG = () => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

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
      downloadLink.download = `${equipment.name.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Equipment QR - ${equipment.name}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              text-align: center;
              padding: 24px;
            }
            .label {
              border: 2px solid #0284c7;
              border-radius: 18px;
              padding: 20px;
              display: inline-block;
              background: #fff;
            }
            .title { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
            .token { font-size: 11px; color: #475569; margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">${equipment.name}</div>
            <div class="token">${token}</div>
            ${qrRef.current?.innerHTML || ''}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 250);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div ref={qrRef} className="p-1.5 bg-white rounded-lg border border-slate-200"><QRCodeSVG value={scanUrl} size={48} /></div>
      <div className="flex flex-col gap-1">
        <Link href={`/equipment/scan?id=${encodeURIComponent(token)}`} className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1">
          <QrCode className="w-3.5 h-3.5" /> Open scan flow
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleDownloadPNG} className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Save PNG
          </button>
          <button type="button" onClick={handlePrint} className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
