'use client';

import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { QrCode } from 'lucide-react';
import { Equipment } from '@/types';

export function EquipmentQRCodeDisplay({ equipment }: { equipment: Equipment }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/sunny' : '');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aheiner2001.github.io';
  const token = equipment.qrCodeToken || equipment.qrCode;
  if (!token) {
    return <span className="text-[11px] text-slate-400">No QR code assigned</span>;
  }
  const scanUrl = `${origin}${basePath}/equipment/scan?id=${encodeURIComponent(token)}`;
  return (
    <div className="flex items-center gap-3">
      <div className="p-1.5 bg-white rounded-lg border border-slate-200"><QRCodeSVG value={scanUrl} size={48} /></div>
      <Link href={`/equipment/scan?id=${encodeURIComponent(token)}`} className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1">
        <QrCode className="w-3.5 h-3.5" /> Open scan flow
      </Link>
    </div>
  );
}
