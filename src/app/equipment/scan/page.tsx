import EquipmentScanClient from './EquipmentScanClient';
import { Suspense } from 'react';

export default function EquipmentScanPage() {
  return <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading equipment scan...</div>}><EquipmentScanClient /></Suspense>;
}
