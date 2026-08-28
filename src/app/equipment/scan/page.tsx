import EquipmentScanClient from './EquipmentScanClient';
import { Suspense } from 'react';

export default function EquipmentScanPage() {
  return <Suspense fallback={<div className="p-8 text-center text-xs text-ink-muted">Loading equipment scan...</div>}><EquipmentScanClient /></Suspense>;
}
