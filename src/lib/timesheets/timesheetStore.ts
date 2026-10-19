import type { ShiftRecord, CorrectionRequest, AuditEvent, ActiveShiftGuard } from './types';
import type { Inspection, MissedReturn } from '@/types';
import { buildHistoricalEstimates, overlapsHistoricalHours } from './historicalRecovery';
import { validateShiftInterval } from './timeCalculations';
import { db, ensureAuth } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocsFromServer,
  runTransaction,
  getDoc,
  query,
  where,
} from 'firebase/firestore';

export const TIMESHEET_STORAGE_KEYS = {
  SHIFTS: 'sunny_timesheet_shifts',
  GUARDS: 'sunny_timesheet_guards',
  AUDIT: 'sunny_timesheet_audit',
  CORRECTIONS: 'sunny_timesheet_corrections',
  INITIALIZED: 'sunny_timesheet_initialized',
};

export const FIRESTORE_COLLECTIONS = {
  SHIFTS: 'timesheet_shifts',
  GUARDS: 'timesheet_guards',
  AUDIT: 'timesheet_audit',
  CORRECTIONS: 'timesheet_corrections',
};

/**
 * Sanitizes data structures before sending to Cloud Firestore.
 * Converts any `undefined` values to `null` to avoid Firestore rejection.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as any;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      result[key] = null;
    } else if (value !== null && typeof value === 'object') {
      result[key] = sanitizeForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

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
    employeeId: 'user-sarah',
    employeeName: 'Sarah Connor',
    locationId: 'loc-main',
    status: 'approved',
    timeZone: 'America/Denver',
    startAtUtc: '2026-10-12T13:30:00.000Z',
    endAtUtc: '2026-10-12T21:30:00.000Z',
    unpaidBreakSeconds: 1800,
    startSource: 'manual',
    endSource: 'manual',
    startEventId: 'evt-seed-4a',
    endEventId: 'evt-seed-4b',
    revision: 1,
    createdAt: '2026-10-12T13:30:00.000Z',
    updatedAt: '2026-10-13T08:30:00.000Z',
    submittedAt: '2026-10-12T21:30:00.000Z',
    approvedAt: '2026-10-13T08:30:00.000Z',
    approvedBy: 'user-jacob',
    managerNote: 'Trainee shift verified with lead technician.',
  },
  {
    id: 'seed-shift-5',
    employeeId: 'user-sarah',
    employeeName: 'Sarah Connor',
    locationId: 'loc-main',
    status: 'pending',
    timeZone: 'America/Denver',
    startAtUtc: '2026-10-14T14:00:00.000Z',
    endAtUtc: '2026-10-14T22:00:00.000Z',
    unpaidBreakSeconds: 1800,
    startSource: 'manual',
    endSource: 'manual',
    startEventId: 'evt-seed-5a',
    endEventId: 'evt-seed-5b',
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
    id: 'seed-corr-1',
    shiftId: 'seed-shift-3',
    employeeId: 'user-john',
    employeeName: 'John Smith',
    proposedStart: '2026-10-14T13:00:00.000Z',
    proposedEnd: '2026-10-14T21:00:00.000Z',
    proposedBreakSeconds: 1800,
    timeZone: 'America/Denver',
    reason: 'Added 30 minute unpaid lunch break as requested by manager.',
    status: 'pending',
    baseRevision: 2,
    submittedAt: '2026-10-14T21:20:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
  },
  {
    id: 'seed-corr-2',
    shiftId: null,
    employeeId: 'user-sarah',
    employeeName: 'Sarah Connor',
    proposedStart: '2026-10-13T15:00:00.000Z',
    proposedEnd: '2026-10-13T20:00:00.000Z',
    proposedBreakSeconds: 0,
    timeZone: 'America/Denver',
    reason: 'Forgot to clock in during special warehouse inventory training.',
    status: 'pending',
    baseRevision: 1,
    submittedAt: '2026-10-14T09:00:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
  },
];

export const SAMPLE_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'seed-aud-1',
    shiftId: 'seed-shift-1',
    actorId: 'user-john',
    actorName: 'John Smith',
    action: 'clock_in',
    beforeValues: null,
    afterValues: {
      id: 'seed-shift-1',
      employeeId: 'user-john',
      status: 'active',
      startAtUtc: '2026-10-12T14:00:00.000Z',
    },
    reason: null,
    revision: 1,
    eventId: 'evt-seed-1a',
    timestamp: '2026-10-12T14:00:00.000Z',
  },
  {
    id: 'seed-aud-2',
    shiftId: 'seed-shift-1',
    actorId: 'user-john',
    actorName: 'John Smith',
    action: 'clock_out',
    beforeValues: {
      status: 'active',
      endAtUtc: null,
    },
    afterValues: {
      status: 'pending',
      endAtUtc: '2026-10-12T22:30:00.000Z',
      unpaidBreakSeconds: 1800,
    },
    reason: null,
    revision: 2,
    eventId: 'evt-seed-1b',
    timestamp: '2026-10-12T22:30:00.000Z',
  },
  {
    id: 'seed-aud-3',
    shiftId: 'seed-shift-1',
    actorId: 'user-jacob',
    actorName: 'Jacob Stone',
    action: 'approve',
    beforeValues: {
      status: 'pending',
      approvedAt: null,
    },
    afterValues: {
      status: 'approved',
      approvedAt: '2026-10-13T09:00:00.000Z',
      approvedBy: 'user-jacob',
    },
    reason: 'Verified complete detailing run.',
    revision: 3,
    eventId: 'evt-seed-1c',
    timestamp: '2026-10-13T09:00:00.000Z',
  },
  {
    id: 'seed-aud-4',
    shiftId: 'seed-shift-3',
    actorId: 'user-jacob',
    actorName: 'Jacob Stone',
    action: 'return_for_correction',
    beforeValues: {
      status: 'pending',
    },
    afterValues: {
      status: 'needs_correction',
      managerNote: 'Please record the 30-minute lunch break taken during the afternoon shift.',
    },
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

  private initialized = false;
  private listening = false;
  private pendingSyncs = new Set<Promise<any>>();

  constructor() {
    if (this.isClient()) {
      this.hydrateFromLocalStorage();
    }
  }

  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private isCloudSyncEnabled(): boolean {
    if (!this.isClient() || !db) return false;
    // In automated unit tests without real Firestore emulator, don't initiate unmocked live network RPCs
    if (typeof process !== 'undefined' && process.env?.VITEST && !process.env?.FIREBASE_EMULATOR_HOST) {
      const isMocked = (setDoc as any)?.mock !== undefined || (db as any)?._isMock || (onSnapshot as any)?.mock !== undefined;
      return Boolean(isMocked);
    }
    return true;
  }

  private notifyListeners(): void {
    if (this.isClient()) {
      try {
        window.dispatchEvent(new Event('sunny_timesheet_update'));
      } catch {
        // Safe fallback in restricted environments
      }
    }
  }

  private saveToLocalStorage(key: string, data: any): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`LocalStorage write error for ${key}:`, e);
    }
  }

  private readFromLocalStorage<T>(key: string): T | null {
    if (!this.isClient()) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private hydrateFromLocalStorage(): void {
    const storedShifts = this.readFromLocalStorage<ShiftRecord[]>(TIMESHEET_STORAGE_KEYS.SHIFTS);
    if (storedShifts && Array.isArray(storedShifts)) {
      this.shifts.clear();
      storedShifts.forEach((s) => this.shifts.set(s.id, s));
    }

    const storedGuards = this.readFromLocalStorage<ActiveShiftGuard[]>(TIMESHEET_STORAGE_KEYS.GUARDS);
    if (storedGuards && Array.isArray(storedGuards)) {
      this.guards.clear();
      storedGuards.forEach((g) => this.guards.set(g.employeeId, g));
    }

    const storedAudit = this.readFromLocalStorage<AuditEvent[]>(TIMESHEET_STORAGE_KEYS.AUDIT);
    if (storedAudit && Array.isArray(storedAudit)) {
      this.auditEvents = storedAudit;
    }

    const storedCorrections = this.readFromLocalStorage<CorrectionRequest[]>(TIMESHEET_STORAGE_KEYS.CORRECTIONS);
    if (storedCorrections && Array.isArray(storedCorrections)) {
      this.correctionRequests.clear();
      storedCorrections.forEach((c) => this.correctionRequests.set(c.id, c));
    }
  }

  public init(): void {
    if (!this.isClient()) return;
    this.hydrateFromLocalStorage();
    this.initialized = true;
    void this.setupFirestoreListeners();
  }

  private listenerGeneration = 0;
  private unsubscribers: Array<() => void> = [];

  public async setupFirestoreListeners(): Promise<void> {
    if (!this.isCloudSyncEnabled() || this.listening || !db) return;
    this.listening = true;
    const generation = ++this.listenerGeneration;
    this.setSyncStatus('Connecting to Firebase…');
    const confirmed = new Set<string>();
    const fail = () => {
      if (generation !== this.listenerGeneration) return;
      this.listenerGeneration++;
      this.unsubscribers.forEach(unsubscribe => unsubscribe());
      this.unsubscribers = [];
      this.listening = false;
      this.setSyncStatus('Cloud sync failed. Check connection and Firebase permissions, then retry.');
    };
    try {
      if (!await ensureAuth()) throw new Error('Firebase authentication unavailable');
      if (generation !== this.listenerGeneration) return;
      const listeners = [
        [FIRESTORE_COLLECTIONS.SHIFTS, TIMESHEET_STORAGE_KEYS.SHIFTS, this.shifts, 'id'],
        [FIRESTORE_COLLECTIONS.GUARDS, TIMESHEET_STORAGE_KEYS.GUARDS, this.guards, 'employeeId'],
        [FIRESTORE_COLLECTIONS.CORRECTIONS, TIMESHEET_STORAGE_KEYS.CORRECTIONS, this.correctionRequests, 'id'],
      ] as const;
      const status = (name: string, cached: boolean) => {
        if (cached) confirmed.delete(name);
        else confirmed.add(name);
        this.setSyncStatus(cached ? 'Showing cached timesheets — waiting for cloud confirmation' :
          confirmed.size === 4 ? 'Firebase Cloud Sync Active' : 'Loading cloud timesheets…');
      };
      // Keep callback ordering shifts, guards, audit, corrections for existing consumers/tests.
      const subscribe = (name: string, receive: (snapshot: any) => void) => {
        this.unsubscribers.push(onSnapshot(collection(db!, name), { includeMetadataChanges: true }, snapshot => {
          if (generation !== this.listenerGeneration) return;
          receive(snapshot);
          status(name, Boolean(snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites));
        }, fail));
      };
      const receiveMap = (key: string, map: Map<string, any>, id: string) => (snapshot: any) => {
        if (!snapshot.metadata?.fromCache) map.clear();
        snapshot.forEach((d: any) => { const value = d.data(); map.set(value[id], value); });
        this.saveToLocalStorage(key, Array.from(map.values()));
      };
      subscribe(listeners[0][0], receiveMap(listeners[0][1], this.shifts, 'id'));
      subscribe(listeners[1][0], receiveMap(listeners[1][1], this.guards, 'employeeId'));
      subscribe(FIRESTORE_COLLECTIONS.AUDIT, snapshot => {
        const events = new Map<string, AuditEvent>();
        if (snapshot.metadata?.fromCache) this.auditEvents.forEach(event => events.set(event.id, event));
        snapshot.forEach((d: any) => { const event = d.data() as AuditEvent; events.set(event.id, event); });
        this.auditEvents = Array.from(events.values());
        this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.AUDIT, this.auditEvents);
      });
      subscribe(listeners[2][0], receiveMap(listeners[2][1], this.correctionRequests, 'id'));
    } catch {
      fail();
    }
  }

  /** Guard, shift and audit commit together; callbacks must have no local side effects. */
  public async transactPunch(
    employeeId: string,
    eventId: string,
    update: (active: ShiftRecord | null) => { shift: ShiftRecord; audit?: AuditEvent },
  ): Promise<ShiftRecord> {
    const receiptId = `punch-${encodeURIComponent(employeeId)}:${encodeURIComponent(eventId)}`;
    if (!this.isCloudSyncEnabled() || !db) {
      const receipt = this.auditEvents.find(e => e.actorId === employeeId && e.eventId === eventId);
      const previous = receipt && this.getShift(receipt.shiftId);
      if (previous) return previous;
      const guard = this.getActiveShiftGuard(employeeId);
      const result = update(guard?.activeShiftId ? this.getShift(guard.activeShiftId) : null);
      if (result.audit) {
        this.saveShift(result.shift);
        if (result.shift.status === 'active') this.setActiveShiftGuard(employeeId, result.shift.id);
        else this.clearActiveShiftGuard(employeeId);
        this.appendAuditEvent({ ...result.audit, id: receiptId });
      }
      return result.shift;
    }
    this.setSyncStatus('Saving timesheet…');
    try {
      if (!await ensureAuth()) throw new Error('Firebase authentication unavailable. Please retry.');
      const result = await runTransaction(db, async transaction => {
        const receiptRef = doc(db!, FIRESTORE_COLLECTIONS.AUDIT, receiptId);
        const guardRef = doc(db!, FIRESTORE_COLLECTIONS.GUARDS, employeeId);
        const receipt = await transaction.get(receiptRef);
        if (receipt.exists()) {
          const previous = await transaction.get(doc(db!, FIRESTORE_COLLECTIONS.SHIFTS, receipt.data().shiftId));
          if (!previous.exists()) throw new Error('SHIFT_NOT_FOUND');
          return { shift: previous.data() as ShiftRecord };
        }
        const guardDoc = await transaction.get(guardRef);
        const guard = guardDoc.exists() ? guardDoc.data() as ActiveShiftGuard : null;
        let active: ShiftRecord | null = null;
        if (guard?.activeShiftId) {
          const shiftDoc = await transaction.get(doc(db!, FIRESTORE_COLLECTIONS.SHIFTS, guard.activeShiftId));
          if (!shiftDoc.exists()) throw new Error('Active shift record missing. Contact your manager.');
          active = shiftDoc.data() as ShiftRecord;
        }
        const next = update(active);
        if (!next.audit) return next;
        transaction.set(doc(db!, FIRESTORE_COLLECTIONS.SHIFTS, next.shift.id), sanitizeForFirestore(next.shift));
        transaction.set(guardRef, {
          employeeId, activeShiftId: next.shift.status === 'active' ? next.shift.id : null,
          revision: (guard?.revision || 0) + 1,
        });
        transaction.set(receiptRef, sanitizeForFirestore({ ...next.audit, id: receiptId }));
        return next;
      });
      // Hydrate only acknowledged data. Never re-send a transaction through local setters.
      this.shifts.set(result.shift.id, result.shift);
      // A replay can refer to an older shift: do not overwrite the current guard from it.
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.SHIFTS, Array.from(this.shifts.values()));
      if (result.audit) {
        this.guards.set(employeeId, {
          employeeId, activeShiftId: result.shift.status === 'active' ? result.shift.id : null,
          revision: (this.guards.get(employeeId)?.revision || 0) + 1,
        });
        this.auditEvents.push({ ...result.audit, id: receiptId });
        this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.GUARDS, Array.from(this.guards.values()));
        this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.AUDIT, this.auditEvents);
      }
      this.setSyncStatus('Last timesheet save confirmed');
      return { ...result.shift };
    } catch (error) {
      this.setSyncStatus('Timesheet save failed. Check connection and Firebase permissions, then retry.');
      throw error;
    }
  }

  /** Import a reviewed estimate without ever punching or closing the employee's current shift. */
  public async saveRecoveredShift(shift: ShiftRecord): Promise<ShiftRecord> {
    if (shift.status !== 'pending' || !shift.recovery || !shift.endAtUtc ||
      shift.approvedAt || shift.approvedBy ||
      !validateShiftInterval(shift.startAtUtc, shift.endAtUtc, shift.unpaidBreakSeconds).valid)
      throw new Error('Invalid historical estimate.');
    const audit: AuditEvent = {
      id: `recovery-${shift.id}`, shiftId: shift.id, actorId: shift.recovery.recoveredBy,
      actorName: shift.recovery.recoveredByName, action: 'recover_estimate', beforeValues: null, afterValues: { ...shift },
      reason: shift.managerNote || 'Estimated historical hours awaiting manager review', revision: 1,
      eventId: shift.id, timestamp: shift.createdAt,
    };
    const check = (shifts: ShiftRecord[], corrections: CorrectionRequest[]) => {
      if (shifts.some(existing => existing.id === shift.id ||
        existing.recovery?.inspectionId === shift.recovery!.inspectionId ||
        existing.recovery?.returnInspectionId === shift.recovery!.returnInspectionId))
        throw new Error('This inspection or return has already been recovered.');
      if (overlapsHistoricalHours(shift.employeeId, shift.startAtUtc, shift.endAtUtc!, shifts, corrections))
        throw new Error('Existing hours or a pending request overlap this estimate. Refresh and review them first.');
    };
    if (!this.isCloudSyncEnabled() || !db) {
      check(this.getAllShifts(), this.getAllCorrectionRequests());
      this.saveShift(shift);
      this.appendAuditEvent(audit);
      return { ...shift };
    }
    this.setSyncStatus('Saving historical estimate…');
    try {
      if (!await ensureAuth()) throw new Error('Firebase authentication unavailable. Please retry.');
      const guardRef = doc(db, FIRESTORE_COLLECTIONS.GUARDS, shift.employeeId);
      // All punch/recovery transactions update this guard revision. Reject a stale preview if it changed.
      const beforeGuard = await getDoc(guardRef);
      const revision = beforeGuard.exists() ? beforeGuard.data().revision || 0 : 0;
      const [remoteShifts, remoteCorrections] = await Promise.all([
        getDocsFromServer(query(collection(db, FIRESTORE_COLLECTIONS.SHIFTS), where('employeeId', '==', shift.employeeId))),
        getDocsFromServer(query(collection(db, FIRESTORE_COLLECTIONS.CORRECTIONS), where('employeeId', '==', shift.employeeId))),
      ]);
      const [sourceSnapshot, missedSnapshot] = await Promise.all([
        getDocsFromServer(query(collection(db, 'inspections'), where('userId', '==', shift.employeeId))),
        getDocsFromServer(query(collection(db, 'missedReturns'), where('userId', '==', shift.employeeId))),
      ]);
      const evidence: Inspection[] = [], missed: MissedReturn[] = [];
      sourceSnapshot.forEach(record => evidence.push(record.data() as Inspection));
      missedSnapshot.forEach(record => missed.push(record.data() as MissedReturn));
      const confirmed = buildHistoricalEstimates(evidence, [], [], missed).find(row => row.inspectionId === shift.recovery!.inspectionId);
      if (!confirmed || confirmed.state !== 'ready' || confirmed.returnInspectionId !== shift.recovery.returnInspectionId ||
        confirmed.startAtUtc !== shift.startAtUtc || confirmed.endAtUtc !== shift.endAtUtc)
        throw new Error('Inspection evidence changed or cannot be confirmed. Refresh and review the source records.');
      const shifts: ShiftRecord[] = [], corrections: CorrectionRequest[] = [];
      remoteShifts.forEach(record => shifts.push(record.data() as ShiftRecord));
      remoteCorrections.forEach(record => corrections.push(record.data() as CorrectionRequest));
      check(shifts, corrections);
      await runTransaction(db, async transaction => {
        const target = doc(db!, FIRESTORE_COLLECTIONS.SHIFTS, shift.id);
        const existing = await transaction.get(target);
        const guard = await transaction.get(guardRef);
        // Read source documents inside the transaction so rejection/deletion/time edits invalidate the import.
        for (const sourceId of [shift.recovery!.inspectionId, shift.recovery!.returnInspectionId]) {
          const source = await transaction.get(doc(db!, 'inspections', sourceId));
          const expected = evidence.find(record => record.id === sourceId);
          const fingerprint = (record: Inspection) => JSON.stringify([record.id, record.userId, record.vehicleId,
            record.kind, record.status, record.startedAt, record.startedAtRecorded, record.submittedAt,
            record.submittedById, record.missedReturnId]);
          if (!source.exists() || !expected || fingerprint(source.data() as Inspection) !== fingerprint(expected))
            throw new Error('Inspection evidence changed. Refresh and review before recovering hours.');
        }
        if (existing.exists()) throw new Error('This estimate has already been recovered.');
        if ((guard.exists() ? guard.data().revision || 0 : 0) !== revision)
          throw new Error('Timesheets changed while recovering hours. Refresh and try again.');
        transaction.set(target, sanitizeForFirestore(shift));
        transaction.set(doc(db!, FIRESTORE_COLLECTIONS.AUDIT, audit.id), sanitizeForFirestore(audit));
        transaction.set(guardRef, { employeeId: shift.employeeId,
          activeShiftId: guard.exists() ? guard.data().activeShiftId || null : null, revision: revision + 1 });
      });
      this.shifts.set(shift.id, { ...shift });
      this.auditEvents.push(audit);
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.SHIFTS, Array.from(this.shifts.values()));
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.AUDIT, this.auditEvents);
      this.setSyncStatus('Historical estimate saved — awaiting manager approval');
      return { ...shift };
    } catch (error) {
      this.setSyncStatus('Historical estimate was not saved. Check the error and retry.');
      throw error;
    }
  }

  private syncStatus = 'Connecting to Firebase…';
  public getSyncStatus(): string {
    return this.isCloudSyncEnabled() ? this.syncStatus : 'Local only — cloud sync unavailable';
  }
  private setSyncStatus(status: string): void {
    this.syncStatus = status;
    this.notifyListeners();
  }

  private trackSync<T>(promise: Promise<T>): Promise<T> {
    this.pendingSyncs.add(promise);
    promise.then(() => this.pendingSyncs.delete(promise), () => this.pendingSyncs.delete(promise));
    return promise;
  }

  public async waitForPendingSyncs(): Promise<void> {
    await Promise.all(Array.from(this.pendingSyncs));
  }

  public async commitShiftWithAudit(shift: ShiftRecord, audit: AuditEvent): Promise<void> {
    if (!shift.recovery || !this.isCloudSyncEnabled() || !db) {
      this.saveShift(shift);
      this.appendAuditEvent(audit);
      await this.waitForPendingSyncs();
      return;
    }
    this.setSyncStatus('Saving recovered hours review…');
    try {
      await this.syncEmployeeRecord(FIRESTORE_COLLECTIONS.SHIFTS, shift.id, shift.employeeId, shift, shift, audit);
      this.shifts.set(shift.id, { ...shift });
      this.auditEvents.push(audit);
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.SHIFTS, Array.from(this.shifts.values()));
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.AUDIT, this.auditEvents);
      this.setSyncStatus('Recovered hours review saved');
    } catch (error) {
      this.setSyncStatus('Review was not saved. Refresh and retry.');
      throw error;
    }
  }

  private async syncEmployeeRecord(collectionName: string, id: string, employeeId: string,
    value: ShiftRecord | CorrectionRequest, recoveredShift?: ShiftRecord, audit?: AuditEvent): Promise<void> {
    if (!this.isCloudSyncEnabled() || !db) return;
    if (!await ensureAuth()) throw new Error('Firebase authentication unavailable. Please retry.');
    const guardRef = doc(db, FIRESTORE_COLLECTIONS.GUARDS, employeeId);
    let expectedRevision: number | undefined;
    if (recoveredShift?.endAtUtc) {
      const before = await getDoc(guardRef);
      expectedRevision = before.exists() ? before.data().revision || 0 : 0;
      const [shiftDocs, correctionDocs] = await Promise.all([
        getDocsFromServer(query(collection(db, FIRESTORE_COLLECTIONS.SHIFTS), where('employeeId', '==', employeeId))),
        getDocsFromServer(query(collection(db, FIRESTORE_COLLECTIONS.CORRECTIONS), where('employeeId', '==', employeeId))),
      ]);
      const shifts: ShiftRecord[] = [], corrections: CorrectionRequest[] = [];
      shiftDocs.forEach(record => { const shift = record.data() as ShiftRecord; if (shift.id !== id) shifts.push(shift); });
      correctionDocs.forEach(record => { const request = record.data() as CorrectionRequest; if (request.shiftId !== id) corrections.push(request); });
      if (overlapsHistoricalHours(employeeId, recoveredShift.startAtUtc, recoveredShift.endAtUtc, shifts, corrections))
        throw new Error('Recovered hours overlap another shift or pending request.');
    }
    await runTransaction(db, async transaction => {
      const guard = await transaction.get(guardRef);
      if (recoveredShift) {
        const current = await transaction.get(doc(db!, collectionName, id));
        if (!current.exists() || current.data().revision !== recoveredShift.revision - 1)
          throw new Error('Shift changed. Refresh before editing or approving.');
      }
      const revision = guard.exists() ? guard.data().revision || 0 : 0;
      if (expectedRevision !== undefined && expectedRevision !== revision)
        throw new Error('Timesheets changed. Refresh and review before saving recovered hours.');
      transaction.set(doc(db!, collectionName, id), sanitizeForFirestore(value), { merge: true });
      if (audit) transaction.set(doc(db!, FIRESTORE_COLLECTIONS.AUDIT, audit.id), sanitizeForFirestore(audit));
      transaction.set(guardRef, { employeeId,
        activeShiftId: guard.exists() ? guard.data().activeShiftId || null : null, revision: revision + 1 });
    });
  }

  // Cloud Sync Workers
  public async syncShiftToCloud(shift: ShiftRecord): Promise<void> {
    if (!this.isCloudSyncEnabled() || !db) return;
    try {
      await this.syncEmployeeRecord(FIRESTORE_COLLECTIONS.SHIFTS, shift.id, shift.employeeId, shift, shift.recovery ? shift : undefined);
    } catch (err) {
      console.warn('Firestore sync error for shift:', err);
      this.setSyncStatus('Timesheet save failed. Check connection and Firebase permissions, then retry.');
      throw err;
    }
  }

  public async deleteShiftFromCloud(id: string): Promise<void> {
    if (!this.isCloudSyncEnabled() || !db) return;
    try {
      await ensureAuth();
      await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.SHIFTS, id));
    } catch (err) {
      console.warn('Firestore delete error for shift:', err);
      this.setSyncStatus('Timesheet save failed. Check connection and Firebase permissions, then retry.');
      throw err;
    }
  }

  public async syncGuardToCloud(guard: ActiveShiftGuard): Promise<void> {
    if (!this.isCloudSyncEnabled() || !db) return;
    try {
      await ensureAuth();
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.GUARDS, guard.employeeId), sanitizeForFirestore(guard), { merge: true });
    } catch (err) {
      console.warn('Firestore sync error for guard:', err);
      this.setSyncStatus('Timesheet save failed. Check connection and Firebase permissions, then retry.');
      throw err;
    }
  }

  public async syncAuditEventToCloud(event: AuditEvent): Promise<void> {
    if (!this.isCloudSyncEnabled() || !db) return;
    try {
      await ensureAuth();
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.AUDIT, event.id), sanitizeForFirestore(event), { merge: true });
    } catch (err) {
      console.warn('Firestore sync error for audit event:', err);
      this.setSyncStatus('Timesheet save failed. Check connection and Firebase permissions, then retry.');
      throw err;
    }
  }

  public async syncCorrectionToCloud(request: CorrectionRequest): Promise<void> {
    if (!this.isCloudSyncEnabled() || !db) return;
    try {
      await this.syncEmployeeRecord(FIRESTORE_COLLECTIONS.CORRECTIONS, request.id, request.employeeId, request);
    } catch (err) {
      console.warn('Firestore sync error for correction request:', err);
      this.setSyncStatus('Timesheet save failed. Check connection and Firebase permissions, then retry.');
      throw err;
    }
  }

  public async deleteCorrectionFromCloud(id: string): Promise<void> {
    if (!this.isCloudSyncEnabled() || !db) return;
    try {
      await ensureAuth();
      await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CORRECTIONS, id));
    } catch (err) {
      console.warn('Firestore delete error for correction request:', err);
      this.setSyncStatus('Timesheet save failed. Check connection and Firebase permissions, then retry.');
      throw err;
    }
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
    this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.SHIFTS, Array.from(this.shifts.values()));
    this.notifyListeners();
    if (this.isCloudSyncEnabled()) {
      void this.trackSync(this.syncShiftToCloud(copy));
    }
    return { ...copy };
  }

  deleteShift(id: string): boolean {
    const result = this.shifts.delete(id);
    if (result) {
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.SHIFTS, Array.from(this.shifts.values()));
      this.notifyListeners();
      if (this.isCloudSyncEnabled()) {
        void this.trackSync(this.deleteShiftFromCloud(id));
      }
    }
    return result;
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
    this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.GUARDS, Array.from(this.guards.values()));
    this.notifyListeners();
    if (this.isCloudSyncEnabled()) {
      void this.trackSync(this.syncGuardToCloud(guard));
    }
    return { ...guard };
  }

  clearActiveShiftGuard(employeeId: string): void {
    const current = this.guards.get(employeeId);
    if (current) {
      const updated: ActiveShiftGuard = {
        employeeId,
        activeShiftId: null,
        revision: current.revision + 1,
      };
      this.guards.set(employeeId, updated);
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.GUARDS, Array.from(this.guards.values()));
      this.notifyListeners();
      if (this.isCloudSyncEnabled()) {
        void this.trackSync(this.syncGuardToCloud(updated));
      }
    }
  }

  // Audit Events
  appendAuditEvent(event: AuditEvent): void {
    this.auditEvents.push({ ...event });
    this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.AUDIT, this.auditEvents);
    this.notifyListeners();
    if (this.isCloudSyncEnabled()) {
      void this.trackSync(this.syncAuditEventToCloud(event));
    }
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
    this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.CORRECTIONS, Array.from(this.correctionRequests.values()));
    this.notifyListeners();
    if (this.isCloudSyncEnabled()) {
      void this.trackSync(this.syncCorrectionToCloud(copy));
    }
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
    const result = this.correctionRequests.delete(id);
    if (result) {
      this.saveToLocalStorage(TIMESHEET_STORAGE_KEYS.CORRECTIONS, Array.from(this.correctionRequests.values()));
      this.notifyListeners();
      if (this.isCloudSyncEnabled()) {
        void this.trackSync(this.deleteCorrectionFromCloud(id));
      }
    }
    return result;
  }

  // Seed helpers for preview mode / local prototypes
  seed(options?: {
    shifts?: ShiftRecord[];
    corrections?: CorrectionRequest[];
    auditEvents?: AuditEvent[];
    syncToCloud?: boolean;
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

    if (options?.syncToCloud && this.isCloudSyncEnabled()) {
      shiftsToSeed.forEach((s) => void this.syncShiftToCloud(s));
      correctionsToSeed.forEach((c) => void this.syncCorrectionToCloud(c));
      auditsToSeed.forEach((a) => void this.syncAuditEventToCloud(a));
    }
  }

  seedIfEmpty(): void {
    if (this.shifts.size === 0) {
      this.seed();
    }
  }

  reset(): void {
    this.listenerGeneration++;
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this.listening = false;
    this.initialized = false;
    this.shifts.clear();
    this.guards.clear();
    this.auditEvents = [];
    this.correctionRequests.clear();
    if (this.isClient()) {
      try {
        localStorage.removeItem(TIMESHEET_STORAGE_KEYS.SHIFTS);
        localStorage.removeItem(TIMESHEET_STORAGE_KEYS.GUARDS);
        localStorage.removeItem(TIMESHEET_STORAGE_KEYS.AUDIT);
        localStorage.removeItem(TIMESHEET_STORAGE_KEYS.CORRECTIONS);
      } catch {
        // ignore storage clean errors in tests
      }
    }
  }
}

export const timesheetStore = new TimesheetStore();
