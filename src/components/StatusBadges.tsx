import React from 'react';
import { InspectionStatus, IssueStatus, VehicleStatus, EquipmentStatus } from '@/types';
import { CheckCircle2, AlertTriangle, Clock, Wrench, CheckCircle, ShieldAlert } from 'lucide-react';

/**
 * Every badge here resolves to one of five states, which are the same five
 * states the card/row status rail uses:
 *
 *   ok       green   — good, nothing to do
 *   flagged  amber   — needs a human
 *   critical red     — out of service
 *   info     ink     — in flight, someone is already on it
 *   idle     grey    — off the board
 *
 * Amber never appears for anything that isn't asking for attention.
 */
type Status = 'ok' | 'flagged' | 'critical' | 'info' | 'idle';

function Badge({
  status,
  label,
  icon,
}: {
  status: Status;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="badge" data-status={status}>
      {icon}
      {label}
    </span>
  );
}

const ICON = 'w-3 h-3';

export function InspectionStatusBadge({ status }: { status: InspectionStatus | null | undefined }) {
  switch (status) {
    case 'passed':
      return <Badge status="ok" label="Passed" icon={<CheckCircle2 className={ICON} />} />;
    case 'issues_found':
      return <Badge status="flagged" label="Issues found" icon={<AlertTriangle className={ICON} />} />;
    case 'in_progress':
      return <Badge status="info" label="In progress" icon={<Clock className={ICON} />} />;
    default:
      return <Badge status="idle" label="Not inspected" />;
  }
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  switch (status) {
    case 'open':
      return <Badge status="flagged" label="Open" />;
    case 'needs_repair':
      return <Badge status="critical" label="Needs repair" />;
    case 'being_repaired':
      return <Badge status="info" label="In repair" />;
    case 'fixed':
      return <Badge status="ok" label="Fixed" />;
  }
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  switch (status) {
    case 'active':
      return <Badge status="ok" label="Available" />;
    case 'in_use':
      return <Badge status="info" label="In use" />;
    case 'maintenance':
      return <Badge status="flagged" label="Maintenance" />;
    case 'inactive':
      return <Badge status="idle" label="Inactive" />;
  }
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  switch (status) {
    case 'working':
      return <Badge status="ok" label="Working" icon={<CheckCircle className={ICON} />} />;
    case 'flagged':
      return <Badge status="flagged" label="Flagged" icon={<AlertTriangle className={ICON} />} />;
    case 'needs_repair':
      return <Badge status="critical" label="Needs repair" icon={<ShieldAlert className={ICON} />} />;
    case 'being_repaired':
      return <Badge status="info" label="In repair" icon={<Wrench className={ICON} />} />;
    case 'fixed':
      return <Badge status="ok" label="Fixed" icon={<CheckCircle className={ICON} />} />;
  }
}
