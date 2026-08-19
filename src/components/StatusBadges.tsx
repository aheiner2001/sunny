import React from 'react';
import { InspectionStatus, IssueStatus, VehicleStatus, EquipmentStatus } from '@/types';
import { CheckCircle2, AlertTriangle, Clock, Wrench, CheckCircle, ShieldAlert } from 'lucide-react';

export function InspectionStatusBadge({ status }: { status: InspectionStatus | null | undefined }) {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        Passed
      </span>
    );
  }
  if (status === 'issues_found') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        Issues Found
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
        <Clock className="w-3.5 h-3.5 text-sky-600" />
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      Not Inspected
    </span>
  );
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100/80 text-amber-800 tracking-wide">
          OPEN
        </span>
      );
    case 'needs_repair':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 tracking-wide">
          NEEDS REPAIR
        </span>
      );
    case 'being_repaired':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 tracking-wide">
          IN REPAIR
        </span>
      );
    case 'fixed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 tracking-wide">
          FIXED
        </span>
      );
  }
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  switch (status) {
    case 'in_use':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          IN USE
        </span>
      );
    case 'active':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          AVAILABLE
        </span>
      );
    case 'maintenance':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          MAINTENANCE
        </span>
      );
    case 'inactive':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
          INACTIVE
        </span>
      );
  }
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  switch (status) {
    case 'working':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-3 h-3 text-emerald-500" /> Working
        </span>
      );
    case 'flagged':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-500" /> Flagged
        </span>
      );
    case 'needs_repair':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldAlert className="w-3 h-3 text-rose-500" /> Needs Repair
        </span>
      );
    case 'being_repaired':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
          <Wrench className="w-3 h-3 text-sky-500" /> In Repair
        </span>
      );
    case 'fixed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-3 h-3 text-emerald-500" /> Fixed
        </span>
      );
  }
}
