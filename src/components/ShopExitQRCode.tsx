'use client';

import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, QrCode } from 'lucide-react';
import { absoluteAssetUrl } from '@/lib/basePath';

export function ShopExitQRCode() {
  const qrRef = useRef<HTMLDivElement>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aheiner2001.github.io';
  const logoUrl = absoluteAssetUrl(origin, '/sunny-logo.png');
  const returnUrl = absoluteAssetUrl(origin, '/return');

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shop exit — return van</title>
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
              position: relative;
            }
            .logo {
              position: absolute;
              top: 16px;
              left: 18px;
              width: 96px;
              height: auto;
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
            .qr-container svg { display: block; }
            .van-num {
              font-size: 28px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 8px 0;
              line-height: 1.1;
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
            <img class="logo" src="${logoUrl}" alt="Sunny logo" />
            <div class="sub">Vehicle Accountability System</div>
            <div class="qr-container">${qrRef.current?.innerHTML || ''}</div>
            <div class="van-num">Shop exit — return van</div>
            <div class="instruction-box">
              Scan to run the shop-exit return checklist
            </div>
            <div class="url-sub">${returnUrl}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
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
      downloadLink.download = 'shop-exit-return-qr.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="bg-surface rounded-[var(--radius-xl)] p-6 sm:p-8 border border-line shadow-sm flex flex-col items-center text-center">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-surface-sunk text-ink flex items-center justify-center font-bold">
          <QrCode className="w-4 h-4" />
        </div>
        <h3 className="text-base font-bold text-ink">Shop-exit QR</h3>
      </div>

      <div
        ref={qrRef}
        className="p-4 bg-surface rounded-[var(--radius-xl)] border-2 border-line shadow-inner flex items-center justify-center mb-4"
      >
        <QRCodeSVG value={returnUrl} size={200} level="H" includeMargin={true} />
      </div>

      <p className="text-[11px] text-ink-faint mb-4 max-w-xs break-all">
        Scans to: <span className="font-semibold text-ink-muted">{returnUrl}</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xs">
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-ink text-white hover:opacity-90 text-xs font-bold shadow-md shadow-sky-600/20 transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Print shop-exit QR</span>
        </button>
        <button
          type="button"
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
