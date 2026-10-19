export type ShiftStatus = 'active' | 'pending' | 'needs_correction' | 'approved';
export type PunchSource = 'qr' | 'manual' | 'checklist_return';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';
export type AuditAction = 
  | 'recover_estimate'
  | 'clock_in' 
  | 'clock_out' 
  | 'request_correction' 
  | 'manager_edit' 
  | 'approve' 
  | 'amend_approve' 
  | 'return_for_correction';

export const SHIFT_STATUSES: readonly ShiftStatus[] = ['active', 'pending', 'needs_correction', 'approved'] as const;
export const PUNCH_SOURCES: readonly PunchSource[] = ['qr', 'manual', 'checklist_return'] as const;
export const CORRECTION_STATUSES: readonly CorrectionStatus[] = ['pending', 'approved', 'rejected'] as const;
export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'recover_estimate',
  'clock_in',
  'clock_out',
  'request_correction',
  'manager_edit',
  'approve',
  'amend_approve',
  'return_for_correction',
] as const;

export interface ShiftRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  locationId: string;
  status: ShiftStatus;
  timeZone: string;
  startAtUtc: string;
  endAtUtc: string | null;
  unpaidBreakSeconds: number;
  startSource: PunchSource;
  endSource: PunchSource | null;
  startEventId: string;
  endEventId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  managerNote?: string;
  recovery?: {
    estimated: true;
    inspectionId: string;
    returnInspectionId: string;
    recoveredBy: string;
    recoveredByName: string;
    recoveredAt: string;
    startBasis: 'inspection started' | 'inspection submitted';
  };
}

export interface CorrectionRequest {
  id: string;
  shiftId: string | null;
  employeeId: string;
  employeeName: string;
  proposedStart: string;
  proposedEnd: string;
  proposedBreakSeconds: number;
  timeZone: string;
  reason: string;
  status: CorrectionStatus;
  baseRevision: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

export interface AuditEvent {
  id: string;
  shiftId: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  beforeValues: Partial<ShiftRecord> | null;
  afterValues: Partial<ShiftRecord>;
  reason: string | null;
  revision: number;
  eventId: string;
  timestamp: string;
}

export interface ActiveShiftGuard {
  employeeId: string;
  activeShiftId: string | null;
  revision: number;
}

export interface TimesheetSummary {
  approvedSeconds: number;
  pendingSeconds: number;
  activeCount: number;
  attentionCount: number;
}
