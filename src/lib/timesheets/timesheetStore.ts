import type { ShiftRecord, CorrectionRequest, AuditEvent, ActiveShiftGuard } from './types';

export const SAMPLE_SHIFTS: ShiftRecord[] = [
  {
    id: 'seed-shift-1',
    employeeId: 'user-john',
    employeeName: 'John Smith',
    locationId: 'loc-main',
    status: 'approved',
    timeZone: 'America/Denver',
    startAtUtc: '2026-10-12T14:00:00.000Z',
    endAtUtc: '2026-10-12T22:30:00.000Z',
    unpaidBreakSeconds: 1800,
    startSource: 'qr',
    endSource: 'checklist_return',
    startEventId: 'evt-seed-1a',
    endEventId: 'evt-seed-1b',
    revision: 2,
    createdAt: '2026-10-12T14:00:00.000Z',
    updatedAt: '2026-10-13T09:00:00.000Z',
    submittedAt: '2026-10-12T22:30:00.000Z',
    approvedAt: '2026-10-13T09:00:00.000Z',
    approvedBy: 'user-jacob',
    managerNote: 'Verified complete detailing run.',
  },
  {
    id: 'seed-shift-2',
    employeeId: 'user-john',
    employeeName: 'John Smith',
    locationId: 'loc-main',
    status: 'pending',
    timeZone: 'America/Denver',
    startAtUtc: '2026-10-13T14:30:00.000Z',
    endAtUtc: '2026-10-13T23:00:00.000Z',
    unpaidBreakSeconds: 1800,
    startSource: 'qr',
    endSource: 'checklist_return',
    startEventId: 'evt-seed-2a',
    endEventId: 'evt-seed-2b',
    revision: 1,
    createdAt: '2026-10-13T14:30:00.000Z',
    updatedAt: '2026-10-13T23:00:00.000Z',
    submittedAt: '2026-10-13T23:00:00.000Z',
    approvedAt: null,
    approvedBy: null,
  },
  {
    id: 'seed-shift-3',
    employeeId: 'user-john',
    employeeName: 'John Smith',
    locationId: 'loc-main',
    status: 'needs_correction',
    timeZone: 'America/Denver',
    startAtUtc: '2026-10-14T13:00:00.000Z',
    endAtUtc: '2026-10-14T21:00:00.000Z',
    unpaidBreakSeconds: 0,
    startSource: 'manual',
    endSource: 'manual',
    startEventId: 'evt-seed-3a',
    endEventId: 'evt-seed-3b',
    revision: 2,
    createdAt: '2026-10-14T13:00:00.000Z',
    updatedAt: '2026-10-14T21:15:00.000Z',
    submittedAt: '2026-10-14T21:00:00.000Z',
    approvedAt: null,
    approvedBy: null,
    managerNote: 'Please record the 30-minute lunch break taken during the afternoon shift.',
  },
  {
    id: 'seed-shift-4',
    employeeId: 'emp-sarah',
    employeeName: 'Sarah Connor',
    locationId: 'loc-main',
    status: 'pending',
    timeZone: 'America/Denver',
    startAtUtc: '2026-10-14T14:00:00.000Z',
    endAtUtc: '2026-10-14T22:00:00.000Z',
    unpaidBreakSeconds: 1800,
    startSource: 'qr',
    endSource: 'checklist_return',
    startEventId: 'evt-seed-4a',
    endEventId: 'evt-seed-4b',
    revision: 1,
    createdAt: '2026-10-14T14:00:00.000Z',
    updatedAt: '2026-10-14T22:00:00.000Z',
    submittedAt: '2026-10-14T22:00:00.000Z',
    approvedAt: null,
    approvedBy: null,
  },
];

export const SAMPLE_CORRECTIONS: CorrectionRequest[] = [
  {
    id: 'seed-cor-1',
    shiftId: 'seed-shift-3',
    employeeId: 'user-john',
    employeeName: 'John Smith',
    proposedStart: '2026-10-14T13:00:00.000Z',
    proposedEnd: '2026-10-14T21:00:00.000Z',
    proposedBreakSeconds: 1800,
    timeZone: 'America/Denver',
    reason: 'Added missing 30 min meal break requested by manager.',
    status: 'pending',
    baseRevision: 2,
    submittedAt: '2026-10-14T21:30:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
  },
];

export const SAMPLE_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'seed-aud-1a',
    shiftId: 'seed-shift-1',
    actorId: 'user-john',
    actorName: 'John Smith',
    action: 'clock_in',
    beforeValues: null,
    afterValues: { id: 'seed-shift-1', status: 'active', startAtUtc: '2026-10-12T14:00:00.000Z' },
    reason: null,
    revision: 1,
    eventId: 'evt-seed-1a',
    timestamp: '2026-10-12T14:00:00.000Z',
  },
  {
    id: 'seed-aud-1b',
    shiftId: 'seed-shift-1',
    actorId: 'user-john',
    actorName: 'John Smith',
    action: 'clock_out',
    beforeValues: { status: 'active' },
    afterValues: { status: 'pending', endAtUtc: '2026-10-12T22:30:00.000Z', unpaidBreakSeconds: 1800 },
    reason: null,
    revision: 2,
    eventId: 'evt-seed-1b',
    timestamp: '2026-10-12T22:30:00.000Z',
  },
  {
    id: 'seed-aud-1c',
    shiftId: 'seed-shift-1',
    actorId: 'user-jacob',
    actorName: 'Jacob Heiner',
    action: 'approve',
    beforeValues: { status: 'pending' },
    afterValues: { status: 'approved', approvedBy: 'user-jacob', approvedAt: '2026-10-13T09:00:00.000Z' },
    reason: 'Verified complete detailing run.',
    revision: 2,
    eventId: 'evt-seed-1c',
    timestamp: '2026-10-13T09:00:00.000Z',
  },
  {
    id: 'seed-aud-3a',
    shiftId: 'seed-shift-3',
    actorId: 'user-jacob',
    actorName: 'Jacob Heiner',
    action: 'return_for_correction',
    beforeValues: { status: 'pending' },
    afterValues: { status: 'needs_correction' },
    reason: 'Please record the 30-minute lunch break taken during the afternoon shift.',
    revision: 2,
    eventId: 'evt-seed-3c',
    timestamp: '2026-10-14T21:15:00.000Z',
  },
];

class TimesheetStore {
  private shifts: Map<string, ShiftRecord> = new Map();
  private guards: Map<string, ActiveShiftGuard> = new Map();
  private auditEvents: AuditEvent[] = [];
  private correctionRequests: Map<string, CorrectionRequest> = new Map();

  reset(): void {
    this.shifts.clear();
    this.guards.clear();
    this.auditEvents = [];
    this.correctionRequests.clear();
  }

  // Shifts
  getShift(id: string): ShiftRecord | null {
    const shift = this.shifts.get(id);
    return shift ? { ...shift } : null;
  }

  getAllShifts(): ShiftRecord[] {
    return Array.from(this.shifts.values())
      .map((s) => ({ ...s }))
      .sort((a, b) => new Date(b.startAtUtc).getTime() - new Date(a.startAtUtc).getTime());
  }

  getShiftsByEmployee(employeeId: string): ShiftRecord[] {
    return this.getAllShifts().filter((s) => s.employeeId === employeeId);
  }

  saveShift(shift: ShiftRecord): ShiftRecord {
    const copy = { ...shift };
    this.shifts.set(copy.id, copy);
    return { ...copy };
  }

  deleteShift(id: string): boolean {
    return this.shifts.delete(id);
  }

  // Active shift guards
  getActiveShiftGuard(employeeId: string): ActiveShiftGuard | null {
    const guard = this.guards.get(employeeId);
    return guard ? { ...guard } : null;
  }

  setActiveShiftGuard(employeeId: string, shiftId: string): ActiveShiftGuard {
    const current = this.guards.get(employeeId);
    const guard: ActiveShiftGuard = {
      employeeId,
      activeShiftId: shiftId,
      revision: (current?.revision || 0) + 1,
    };
    this.guards.set(employeeId, guard);
    return { ...guard };
  }

  clearActiveShiftGuard(employeeId: string): void {
    const current = this.guards.get(employeeId);
    if (current) {
      this.guards.set(employeeId, {
        employeeId,
        activeShiftId: null,
        revision: current.revision + 1,
      });
    }
  }

  // Audit Events
  appendAuditEvent(event: AuditEvent): void {
    this.auditEvents.push({ ...event });
  }

  getAuditEventsForShift(shiftId: string): AuditEvent[] {
    return this.auditEvents
      .filter((e) => e.shiftId === shiftId)
      .map((e) => ({ ...e }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getAllAuditEvents(): AuditEvent[] {
    return this.auditEvents
      .map((e) => ({ ...e }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Corrections
  saveCorrectionRequest(request: CorrectionRequest): CorrectionRequest {
    const copy = { ...request };
    this.correctionRequests.set(copy.id, copy);
    return { ...copy };
  }

  getCorrectionRequest(id: string): CorrectionRequest | null {
    const req = this.correctionRequests.get(id);
    return req ? { ...req } : null;
  }

  getCorrectionRequestsByEmployee(employeeId: string): CorrectionRequest[] {
    return Array.from(this.correctionRequests.values())
      .filter((r) => r.employeeId === employeeId)
      .map((r) => ({ ...r }))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  getAllCorrectionRequests(): CorrectionRequest[] {
    return Array.from(this.correctionRequests.values())
      .map((r) => ({ ...r }))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  deleteCorrectionRequest(id: string): boolean {
    return this.correctionRequests.delete(id);
  }

  // Seed helpers for preview mode / local prototypes
  seed(options?: {
    shifts?: ShiftRecord[];
    corrections?: CorrectionRequest[];
    auditEvents?: AuditEvent[];
  }): void {
    this.reset();
    const shiftsToSeed = options?.shifts ?? SAMPLE_SHIFTS;
    const correctionsToSeed = options?.corrections ?? SAMPLE_CORRECTIONS;
    const auditsToSeed = options?.auditEvents ?? SAMPLE_AUDIT_EVENTS;

    shiftsToSeed.forEach((s) => {
      this.saveShift(s);
      if (s.status === 'active') {
        this.setActiveShiftGuard(s.employeeId, s.id);
      }
    });

    correctionsToSeed.forEach((c) => this.saveCorrectionRequest(c));
    auditsToSeed.forEach((a) => this.appendAuditEvent(a));
  }

  seedIfEmpty(): void {
    if (this.shifts.size === 0) {
      this.seed();
    }
  }
}

export const timesheetStore = new TimesheetStore();
