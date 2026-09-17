'use client';

import { 
  Vehicle, 
  Equipment, 
  ChecklistQuestion, 
  ChecklistCategoryConfig,
  ChecklistConfig,
  Inspection, 
  Issue, 
  IssueStatusLog,
  InspectionResponse,
  IssueStatus,
  IssueType,
  User,
  UserRole,
  EquipmentCategory,
  EquipmentKind,
  EquipmentAssignment,
  EquipmentOption,
  FleetTask,
  ReportSettings,
  AuthSession,
  AppSettings,
  InspectionStatus,
  LifespanMode,
  LifespanStatus,
  VehicleDayLog,
  MissedReturn,
  DamageRegion,
  VehicleDamageEvent,
  VehicleSide
} from '@/types';
import { classifyIssueType } from './issueClassification';
import { checkInFields, checkOutFields, occupancyAfterInspection, shouldAutoReturnVehicle, localDateString } from './occupancy';
import { DEFAULT_RETURN_QUESTIONS, hasReturnForShift, normalizeReturnQuestions, shiftDateStringForVehicle } from './returnFlow';
import { repairDuplicateCategoryIds } from './checklistCategories';
import { assertDamagePayload, normalizeRegion } from './vehicleDamage';
import { 
  computeLifespanStatus,
  calculateLifespanDueDate,
  extendLifespan,
  replaceLifespan,
  retireLifespan,
  unretireLifespan,
  formatIndividualToolName,
  isMultiQtyLifespanItem
} from './lifespan';
import {
  getEquipmentFamilyKey,
  getEquipmentFamilyLabel,
  stripInstanceSuffix
} from './equipmentGrouping';
import { 
  INITIAL_VEHICLES, 
  INITIAL_EQUIPMENT, 
  INITIAL_CATEGORIES,
  INITIAL_CHECKLIST_QUESTIONS, 
  INITIAL_INSPECTIONS, 
  INITIAL_ISSUES, 
  INITIAL_USERS 
} from './mockData';
import { db } from './firebase';
import { ensureAuth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  getDoc,
  getDocs, 
  updateDoc, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

const STORAGE_KEYS = {
  USERS: 'sunny_users',
  VEHICLES: 'sunny_vehicles',
  EQUIPMENT: 'sunny_equipment',
  CATEGORIES: 'sunny_checklist_categories',
  QUESTIONS: 'sunny_checklist_questions',
  CHECKLIST_CONFIG: 'sunny_checklist_config',
  INSPECTIONS: 'sunny_inspections',
  ISSUES: 'sunny_issues',
  SEEDED: 'sunny_seeded_v2',
  FIREBASE_SYNCED: 'sunny_firebase_synced',
  EQUIPMENT_OPTIONS: 'sunny_equipment_options',
  TASKS: 'sunny_tasks',
  REPORT_SETTINGS: 'sunny_report_settings',
  APP_SETTINGS: 'sunny_app_settings',
  SESSION: 'sunny_session',
  VEHICLE_DAY_LOGS: 'sunny_vehicle_day_logs',
  OFFLINE_INSPECTIONS: 'sunny_offline_inspections',
  MISSED_RETURNS: 'sunny_missed_returns',
  OVERNIGHT_RECONCILED: 'sunny_overnight_reconciled',
  VEHICLE_DAMAGE: 'sunny_vehicle_damage',
};

const DEFAULT_CHECKLIST_ID = 'standard-detailing-checklist';

/** Passcode sessions last one work shift, so a scan mid-shift never re-prompts. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Recursively sanitizes data before writing to Cloud Firestore.
 * Converts any `undefined` values to `null` so Firestore does not throw
 * "Unsupported field value: undefined" errors.
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
    return data.map(item => sanitizeForFirestore(item)) as any;
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

class DataStore {
  private initialized = false;
  private listening = false;
  private overnightReconciledFor: string | null = null;

  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  private normalizeEquipment(raw: Equipment): Equipment {
    const kind: EquipmentKind = raw.kind || raw.equipmentType || (raw.isConsumable ? 'consumable' : (raw.category === 'supplies' ? 'consumable' : 'reusable'));
    const legacyVehicleId = raw.vehicleId || null;
    const legacyVehicleNumber = raw.vehicleNumber || null;
    let assignments: EquipmentAssignment[] = Array.isArray(raw.assignments)
      ? raw.assignments
          .filter(a => a && a.vehicleId)
          .map(a => ({
            vehicleId: a.vehicleId,
            vehicleNumber: a.vehicleNumber || 'Vehicle',
            quantity: Math.max(0, Number(a.quantity) || 0),
            requiredQuantity:
              a.requiredQuantity !== undefined && a.requiredQuantity !== null
                ? Math.max(0, Number(a.requiredQuantity) || 0)
                : undefined,
          }))
          .filter(a => a.quantity > 0)
      : [];
    if (assignments.length === 0 && legacyVehicleId) {
      assignments = [{ vehicleId: legacyVehicleId, vehicleNumber: legacyVehicleNumber || 'Vehicle', quantity: 1 }];
    }
    const rawTotal = Number(raw.totalQuantity);
    const assignedQuantity = assignments.reduce((sum, assignment) => sum + assignment.quantity, 0);
    // Quantity is independent of kind: a pool of 12 identical reusable nozzles
    // is as valid as 12 bottles of soap. `kind` only decides whether stock can
    // be consumed. Never report a total below what is already assigned out.
    // A fully consumed item legitimately has a total of 0, so only fall back to
    // 1 when the stored value is missing entirely (legacy records).
    const totalQuantity = Math.max(assignedQuantity, Number.isFinite(rawTotal) ? rawTotal : 1);
    const availableQuantity = Math.max(0, Number(raw.availableQuantity ?? totalQuantity - assignedQuantity));

    const lifespanEnabled = Boolean(raw.lifespanEnabled);
    const lifespanMode = raw.lifespanMode || null;
    const expectedCars = raw.expectedCars != null ? Number(raw.expectedCars) : null;
    const carsUsed = Math.max(0, Number(raw.carsUsed) || 0);
    const expectedMonths = raw.expectedMonths != null ? Number(raw.expectedMonths) : null;
    const lifeStartedAt = raw.lifeStartedAt || null;
    const dueDate = raw.dueDate || (lifeStartedAt && expectedMonths ? calculateLifespanDueDate(lifeStartedAt, expectedMonths) : null);
    const retiredAt = raw.retiredAt || null;
    const lowWearThresholdPercent = raw.lowWearThresholdPercent != null ? Number(raw.lowWearThresholdPercent) : undefined;
    const lifespanStatus = computeLifespanStatus({
      lifespanEnabled,
      lifespanMode,
      expectedCars,
      carsUsed,
      expectedMonths,
      lifeStartedAt,
      dueDate,
      retiredAt,
      lowWearThresholdPercent
    });

    return {
      ...raw,
      lowWearThresholdPercent,
      minRequiredStock: raw.minRequiredStock != null ? Number(raw.minRequiredStock) : 0,
      vehicleId: legacyVehicleId || assignments[0]?.vehicleId || null,
      vehicleNumber: legacyVehicleNumber || assignments[0]?.vehicleNumber || 'Unassigned',
      assetTag: raw.assetTag?.trim() || null,
      toolFamily: raw.toolFamily?.trim() || (lifespanEnabled ? stripInstanceSuffix(raw.name) || null : raw.toolFamily?.trim() || null),
      kind,
      equipmentType: kind,
      isConsumable: kind === 'consumable',
      totalQuantity,
      availableQuantity,
      assignments,
      qrCodeToken: raw.qrCodeToken || raw.qrToken || raw.qrCode || null,
      qrCode: raw.qrCode || raw.qrCodeToken || raw.qrToken || null,
      qrToken: raw.qrToken || raw.qrCodeToken || raw.qrCode || null,
      lifespanEnabled,
      lifespanMode,
      expectedCars,
      carsUsed,
      expectedMonths,
      lifeStartedAt,
      dueDate,
      lifespanStatus,
      retiredAt
    };
  }

  public init() {
    if (!this.isClient() || this.initialized) return;

    if (!localStorage.getItem(STORAGE_KEYS.SEEDED)) {
      // Local-only seed. A fresh browser must never push starter data to the
      // cloud: that would overwrite the live fleet. Firestore listeners will
      // replace this seed with real data moments later.
      this.resetToDefaults({ syncToCloud: false });
    }
    this.initialized = true;
    this.setupFirestoreListeners();
  }

  // Set up real-time bidirectional listeners with Cloud Firestore
  public async setupFirestoreListeners() {
    if (!this.isClient() || this.listening || !db) return;
    this.listening = true;

    // Wait for Firebase Auth to resolve before attaching listeners
    await ensureAuth();

    try {
      // Listen to Users collection
      onSnapshot(collection(db, 'users'), (snapshot) => {
        if (!snapshot.empty) {
          const list: User[] = [];
          snapshot.forEach((d) => list.push(d.data() as User));
          // Keep any locally-seeded passcode when the remote doc predates the
          // passcode field, otherwise a sync would lock everyone out.
          const localById = new Map(this.getUsers().map(u => [u.id, u]));
          const merged = list.map(remote => ({
            ...remote,
            passcode: remote.passcode || localById.get(remote.id)?.passcode
          }));
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore users listener (using local cache):', err.message);
      });

      // Listen to Vehicles collection
      onSnapshot(collection(db, 'vehicles'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: Vehicle[] = [];
          snapshot.forEach((d) => list.push(d.data() as Vehicle));
          localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore vehicles listener (using local cache):', err.message);
      });

      // Listen to Issues collection
      onSnapshot(collection(db, 'issues'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: Issue[] = [];
          snapshot.forEach((d) => list.push(d.data() as Issue));
          localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore issues listener (using local cache):', err.message);
      });

      // Listen to Inspections collection
      onSnapshot(collection(db, 'inspections'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: Inspection[] = [];
          snapshot.forEach((d) => list.push(d.data() as Inspection));
          localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore inspections listener (using local cache):', err.message);
      });

      // Listen to Equipment collection
      onSnapshot(collection(db, 'equipment'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: Equipment[] = [];
          snapshot.forEach((d) => list.push(d.data() as Equipment));
          localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore equipment listener (using local cache):', err.message);
      });

      onSnapshot(collection(db, 'equipmentOptions'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: EquipmentOption[] = [];
          snapshot.forEach((d) => list.push(d.data() as EquipmentOption));
          localStorage.setItem(STORAGE_KEYS.EQUIPMENT_OPTIONS, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => console.warn('Firestore equipment options listener:', err.message));

      onSnapshot(collection(db, 'tasks'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: FleetTask[] = [];
          snapshot.forEach((d) => list.push(d.data() as FleetTask));
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => console.warn('Firestore tasks listener:', err.message));

      onSnapshot(doc(db, 'settings', 'reports'), (snapshot) => {
        if (snapshot.exists()) {
          localStorage.setItem(STORAGE_KEYS.REPORT_SETTINGS, JSON.stringify(snapshot.data()));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => console.warn('Firestore report settings listener:', err.message));

      // Listen to VehicleDayLogs collection
      onSnapshot(collection(db, 'vehicleDayLogs'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: VehicleDayLog[] = [];
          snapshot.forEach((d) => list.push(d.data() as VehicleDayLog));
          localStorage.setItem(STORAGE_KEYS.VEHICLE_DAY_LOGS, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore vehicleDayLogs listener (using local cache):', err.message);
      });

      // Listen to Checklist doc: checklists/standard-detailing-checklist
      onSnapshot(doc(db, 'checklists', DEFAULT_CHECKLIST_ID), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ChecklistConfig;
          if (data.questions && data.questions.length > 0) {
            localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(data.questions));
          }
          if (data.categories && data.categories.length > 0) {
            localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
          }
          localStorage.setItem(STORAGE_KEYS.CHECKLIST_CONFIG, JSON.stringify(data));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore checklist listener (using local cache):', err.message);
      });

    } catch (e: any) {
      console.warn('Could not attach Firestore listeners:', e.message);
    }
  }

  // Push all fleet data directly to Cloud Firestore
  public async syncAllToFirestore(): Promise<{ success: boolean; message: string }> {
    if (!db) return { success: false, message: 'Firestore is not initialized.' };

    // Ensure Firebase Auth is resolved before writing
    await ensureAuth();

    try {
      const batch = writeBatch(db);

      // Seed Users
      this.getUsers().forEach((u) => {
        const ref = doc(db, 'users', u.id);
        batch.set(ref, sanitizeForFirestore(u));
      });

      // Seed Vehicles
      this.getVehicles().forEach((v) => {
        const ref = doc(db, 'vehicles', v.id);
        batch.set(ref, sanitizeForFirestore(v));
      });

      // Seed Equipment
      this.getEquipment().forEach((eq) => {
        const ref = doc(db, 'equipment', eq.id);
        batch.set(ref, sanitizeForFirestore(eq));
      });

      // Seed Inspections
      this.getInspections().forEach((insp) => {
        const ref = doc(db, 'inspections', insp.id);
        batch.set(ref, sanitizeForFirestore(insp));
      });

      // Seed Issues
      this.getIssues().forEach((iss) => {
        const ref = doc(db, 'issues', iss.id);
        batch.set(ref, sanitizeForFirestore(iss));
      });

      this.getVehicleDayLogs().forEach((log) => {
        const ref = doc(db, 'vehicleDayLogs', log.id);
        batch.set(ref, sanitizeForFirestore(log));
      });

      this.getEquipmentOptions().forEach((option) => {
        batch.set(doc(db, 'equipmentOptions', option.id), sanitizeForFirestore(option));
      });
      this.getTasks().forEach((task) => {
        batch.set(doc(db, 'tasks', task.id), sanitizeForFirestore(task));
      });
      batch.set(doc(db, 'settings', 'reports'), sanitizeForFirestore(this.getReportSettings()));

      // Seed Standard Checklist Document
      const checklistConfig = this.getChecklistConfig();
      const checklistRef = doc(db, 'checklists', DEFAULT_CHECKLIST_ID);
      batch.set(checklistRef, sanitizeForFirestore(checklistConfig));

      await batch.commit();
      localStorage.setItem(STORAGE_KEYS.FIREBASE_SYNCED, 'true');
      return { success: true, message: 'Successfully synced all fleet data to Firebase Cloud Firestore!' };
    } catch (err: any) {
      console.error('Firestore sync error:', err);
      return { 
        success: false, 
        message: err.message || 'Permission denied or Firestore rules not configured. Check Firebase Console security rules.' 
      };
    }
  }

  /**
   * Restores the built-in starter data.
   *
   * `syncToCloud` must stay false for the automatic first-run seed and true only
   * for an explicit manager-triggered factory reset, so that simply opening the
   * app on a new device cannot clobber the live Firestore fleet.
   */
  public resetToDefaults(options: { syncToCloud?: boolean } = {}) {
    if (!this.isClient()) return;
    const { syncToCloud = true } = options;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(INITIAL_EQUIPMENT));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_CHECKLIST_QUESTIONS));
    
    const initialConfig: ChecklistConfig = {
      id: DEFAULT_CHECKLIST_ID,
      name: 'Standard Detailing Checklist',
      categories: INITIAL_CATEGORIES,
      questions: INITIAL_CHECKLIST_QUESTIONS,
      returnQuestions: DEFAULT_RETURN_QUESTIONS,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.CHECKLIST_CONFIG, JSON.stringify(initialConfig));

    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(INITIAL_INSPECTIONS));
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(INITIAL_ISSUES));
    localStorage.setItem(STORAGE_KEYS.VEHICLE_DAY_LOGS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.VEHICLE_DAMAGE, JSON.stringify([]));
    const nowIso = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT_OPTIONS, JSON.stringify(
      INITIAL_EQUIPMENT.map((eq, index) => ({
        id: `equipment-option-${index + 1}`,
        name: eq.name,
        category: eq.category,
        createdAt: nowIso,
        updatedAt: nowIso
      }))
    ));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.REPORT_SETTINGS, JSON.stringify({
      enabledMetrics: ['pass_rate', 'issues', 'fleet_size'],
      updatedAt: nowIso
    }));
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify({
      recentInspectorsDepth: 3
    }));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');

    // Only an explicit factory reset propagates the starter set to the cloud.
    if (db && syncToCloud) {
      this.syncAllToFirestore().catch((e) => console.warn('Sync to Firestore on reset fallback:', e));
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }

  // Clears all fleet entities while preserving checklist structure
  public async clearAllData(): Promise<void> {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  // ==========================================
  // USERS / EMPLOYEES (Manager CRUD)
  // ==========================================
  public getUsers(): User[] {
    if (!this.isClient()) return INITIAL_USERS;
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : INITIAL_USERS;
  }

  public getUser(id: string): User | undefined {
    return this.getUsers().find(u => u.id === id);
  }

  // ==========================================
  // PASSCODE AUTH / SESSION
  // ==========================================

  /** Resolves a typed passcode to its active user. Role follows from that user. */
  public getUserByPasscode(passcode: string): User | undefined {
    const code = (passcode || '').trim();
    if (!code) return undefined;
    return this.getUsers().find(u => u.status !== 'inactive' && (u.passcode || '').trim() === code);
  }

  /**
   * Returns the user already holding this passcode, ignoring `exceptUserId` so
   * an edit does not collide with itself. Duplicates would make the second
   * holder permanently unable to sign in, since lookup returns the first match.
   */
  public findPasscodeConflict(passcode: string, exceptUserId?: string): User | undefined {
    const code = (passcode || '').trim();
    if (!code) return undefined;
    return this.getUsers().find(u => u.id !== exceptUserId && (u.passcode || '').trim() === code);
  }

  /** True when a temporary manager grant is present and not yet expired. */
  public hasActiveManagerGrant(user?: User | null): boolean {
    const until = user?.tempManagerUntil;
    if (!until) return false;
    const expiry = new Date(until).getTime();
    return Number.isFinite(expiry) && expiry > Date.now();
  }

  /**
   * Permission role: a true manager, or an employee holding an unexpired grant.
   * Distinct from `user.role`, which stays the account's real role.
   */
  public getEffectiveRole(user?: User | null): UserRole {
    if (!user) return 'employee';
    if (user.role === 'manager') return 'manager';
    return this.hasActiveManagerGrant(user) ? 'manager' : 'employee';
  }

  /**
   * Grants temporary manager access. Only a true manager may call this; a
   * day-admin extending their own grant would make elevation permanent.
   */
  public async grantTemporaryManager(
    grantedBy: User,
    targetUserId: string,
    durationMs: number
  ): Promise<User> {
    if (grantedBy.role !== 'manager') {
      throw new Error('Only a manager account can grant admin access.');
    }
    const target = this.getUser(targetUserId);
    if (!target) throw new Error('Account not found.');
    if (target.role === 'manager') throw new Error(`${target.name} is already a manager.`);
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Invalid grant duration.');

    return this.updateUser({
      ...target,
      tempManagerUntil: new Date(Date.now() + durationMs).toISOString()
    });
  }

  public async revokeTemporaryManager(revokedBy: User, targetUserId: string): Promise<User> {
    if (revokedBy.role !== 'manager') {
      throw new Error('Only a manager account can revoke admin access.');
    }
    const target = this.getUser(targetUserId);
    if (!target) throw new Error('Account not found.');
    return this.updateUser({ ...target, tempManagerUntil: null });
  }

  /** True while the account still uses a code shipped in the initial seed. */
  public isUsingInitialPasscode(user?: User | null): boolean {
    const code = (user?.passcode || '').trim();
    if (!code) return false;
    return INITIAL_USERS.some(seed => (seed.passcode || '').trim() === code);
  }

  /**
   * Changes an account's own passcode, verifying the current one first.
   *
   * Writes to Firestore BEFORE localStorage and deliberately does not swallow
   * cloud errors: a passcode that only changed locally would leave the old code
   * working on every other device, which is worse than a visible failure.
   */
  public async changeUserPasscode(
    userId: string,
    currentPasscode: string,
    newPasscode: string
  ): Promise<User> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const account = this.getUser(userId);
    if (!account) throw new Error('Account not found.');
    if ((account.passcode || '').trim() !== (currentPasscode || '').trim()) {
      throw new Error('Current passcode is incorrect.');
    }

    const next = (newPasscode || '').trim();
    if (!/^\d{4,6}$/.test(next)) throw new Error('New passcode must be 4 to 6 digits.');
    if (next === (account.passcode || '').trim()) {
      throw new Error('New passcode must be different from the current one.');
    }
    const conflict = this.findPasscodeConflict(next, userId);
    if (conflict) throw new Error(`Passcode ${next} is already assigned to ${conflict.name}.`);

    const updated: User = { ...account, passcode: next };

    if (db) {
      await ensureAuth();
      await setDoc(doc(db, 'users', userId), sanitizeForFirestore(updated), { merge: true });
    }

    const users = this.getUsers().map(u => (u.id === userId ? updated : u));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('sunny_db_update'));
    return updated;
  }

  /** Random unused 4-digit code, avoiding trivially guessable repeats. */
  public generateUniquePasscode(): string {
    const taken = new Set(this.getUsers().map(u => (u.passcode || '').trim()).filter(Boolean));
    for (let attempt = 0; attempt < 200; attempt++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!taken.has(code) && !/^(\d)\1{3}$/.test(code)) return code;
    }
    // Fall back to the first free code in range rather than returning a duplicate.
    for (let n = 1000; n <= 9999; n++) {
      const code = String(n);
      if (!taken.has(code)) return code;
    }
    throw new Error('No passcodes remain available.');
  }

  /**
   * Reads the persisted session, returning null when it is missing, expired,
   * or points at a user who no longer exists.
   */
  public getSession(): AuthSession | null {
    if (!this.isClient()) return null;
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;

    let session: AuthSession;
    try {
      session = JSON.parse(raw);
    } catch {
      this.clearSession();
      return null;
    }

    if (!session?.userId || !session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      this.clearSession();
      return null;
    }

    const owner = this.getUser(session.userId);
    if (!owner || owner.status === 'inactive') {
      this.clearSession();
      return null;
    }

    // Role can change from the employees page after the session was issued.
    return { ...session, role: owner.role };
  }

  public createSession(user: User): AuthSession {
    const now = Date.now();
    const session: AuthSession = {
      userId: user.id,
      role: user.role,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
    };
    if (this.isClient()) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    }
    return session;
  }

  public clearSession(): void {
    if (!this.isClient()) return;
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem('sunny_current_user_id');
  }

  public async createUser(userData: {
    name: string;
    email?: string;
    role: UserRole;
    status?: 'active' | 'inactive';
    avatarUrl?: string;
    avatarStyle?: User['avatarStyle'];
    passcode?: string;
  }): Promise<User> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const requestedCode = userData.passcode?.trim();
    if (requestedCode) {
      const conflict = this.findPasscodeConflict(requestedCode);
      if (conflict) throw new Error(`Passcode ${requestedCode} is already assigned to ${conflict.name}.`);
    }

    const timestamp = Date.now();
    const newUser: User = {
      id: `user-${timestamp}`,
      name: userData.name.trim(),
      email: userData.email?.trim().toLowerCase(),
      role: userData.role,
      status: userData.status || 'active',
      avatarUrl: userData.avatarUrl?.trim() || undefined,
      avatarStyle: userData.avatarStyle || 'circle',
      passcode: userData.passcode?.trim() || undefined
    };

    const currentUsers = this.getUsers();
    const updatedUsers = [...currentUsers, newUser];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    if (db) {
      try {
        await setDoc(doc(db, 'users', newUser.id), sanitizeForFirestore(newUser));
      } catch (e) {
        console.warn('Firestore createUser write error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return newUser;
  }

  public async updateUser(updated: User): Promise<User> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const requestedCode = updated.passcode?.trim();
    if (requestedCode) {
      const conflict = this.findPasscodeConflict(requestedCode, updated.id);
      if (conflict) throw new Error(`Passcode ${requestedCode} is already assigned to ${conflict.name}.`);
    }

    const currentUsers = this.getUsers();
    const updatedUsers = currentUsers.map(u => u.id === updated.id ? { ...u, ...updated } : u);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    // Cascade name update to any vehicle currently occupied by this user
    const vehicles = this.getVehicles();
    vehicles.forEach(v => {
      if (v.currentUserId === updated.id && v.currentUserName !== updated.name) {
        this.updateVehicle({
          ...v,
          currentUserName: updated.name
        });
      }
    });

    if (db) {
      try {
        await setDoc(doc(db, 'users', updated.id), sanitizeForFirestore(updated), { merge: true });
      } catch (e) {
        console.warn('Firestore updateUser write error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return updated;
  }

  public async deleteUser(userId: string): Promise<void> {
    if (!this.isClient()) return;
    this.init();

    const currentUsers = this.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentUsers));

    // Reset and return to shop any vehicle currently assigned to this user
    const vehicles = this.getVehicles();
    vehicles.forEach(v => {
      if (v.currentUserId === userId) {
        this.updateVehicle(checkInFields(v));
      }
    });

    if (db) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (e) {
        console.warn('Firestore deleteUser error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }

  // ==========================================
  // VEHICLES (Manager CRUD)
  // ==========================================
  private readVehicleList(): Vehicle[] {
    const data = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    return data ? JSON.parse(data) : [];
  }

  public getVehicles(): Vehicle[] {
    if (!this.isClient()) return [];
    this.init();
    this.reconcileOvernightCheckins();
    return this.readVehicleList();
  }

  /** End yesterday's shifts the first time the app is opened today. */
  private reconcileOvernightCheckins(): void {
    const today = localDateString(new Date());
    if (localStorage.getItem(STORAGE_KEYS.OVERNIGHT_RECONCILED) === today) return;
    localStorage.setItem(STORAGE_KEYS.OVERNIGHT_RECONCILED, today);
    this.overnightReconciledFor = today;
    const list = this.readVehicleList();
    const stale = list.filter(v => shouldAutoReturnVehicle(v));
    if (stale.length === 0) return;

    const inspRaw = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
    const inspections = inspRaw ? JSON.parse(inspRaw) as Inspection[] : [];
    const existingMisses = this.readMissedReturns();
    const existingIds = new Set(existingMisses.map(m => m.id));
    const newMisses: MissedReturn[] = [];
    for (const v of stale) {
      if (!v.currentUserId) continue;
      const shiftDay = shiftDateStringForVehicle(v);
      if (
        hasReturnForShift({
          vehicleId: v.id,
          userId: v.currentUserId,
          shiftDateString: shiftDay,
          inspections,
        })
      ) {
        continue;
      }
      const id = `miss-${v.id}-${shiftDay}-${v.currentUserId}`;
      if (existingIds.has(id)) continue;
      newMisses.push({
        id,
        userId: v.currentUserId,
        userName: v.currentUserName || 'Driver',
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        dateString: shiftDay,
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
        completedReturnInspectionId: null,
      });
    }
    if (newMisses.length > 0) {
      const merged = [...newMisses, ...existingMisses];
      localStorage.setItem(STORAGE_KEYS.MISSED_RETURNS, JSON.stringify(merged));
      if (db) {
        newMisses.forEach((miss) => {
          setDoc(doc(db, 'missedReturns', miss.id), sanitizeForFirestore(miss), { merge: true }).catch((e) =>
            console.warn('Firestore missed-return write error:', e)
          );
        });
      }
    }

    const returnedIds = new Set(stale.map(v => v.id));
    const next = list.map(v => (returnedIds.has(v.id) ? checkInFields(v) : v));
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(next));
    if (db) {
      stale.forEach((v) => {
        const updated = checkInFields(v);
        setDoc(doc(db, 'vehicles', updated.id), sanitizeForFirestore(updated), { merge: true }).catch((e) =>
          console.warn('Firestore overnight check-in write error:', e)
        );
      });
    }
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  private readMissedReturns(): MissedReturn[] {
    const data = localStorage.getItem(STORAGE_KEYS.MISSED_RETURNS);
    return data ? (JSON.parse(data) as MissedReturn[]) : [];
  }

  public getMissedReturns(): MissedReturn[] {
    if (!this.isClient()) return [];
    this.init();
    this.reconcileOvernightCheckins();
    return this.readMissedReturns();
  }

  public getPendingMissedReturnForUser(userId: string): MissedReturn | undefined {
    return this.getMissedReturns().find(m => m.userId === userId && m.status === 'pending');
  }

  public async completeMissedReturn(id: string, returnInspectionId: string): Promise<void> {
    if (!this.isClient()) return;
    const list = this.readMissedReturns();
    const next = list.map(m =>
      m.id === id
        ? {
            ...m,
            status: 'done' as const,
            completedAt: new Date().toISOString(),
            completedReturnInspectionId: returnInspectionId,
          }
        : m
    );
    localStorage.setItem(STORAGE_KEYS.MISSED_RETURNS, JSON.stringify(next));
    const updated = next.find(m => m.id === id);
    if (db && updated) {
      setDoc(doc(db, 'missedReturns', id), sanitizeForFirestore(updated), { merge: true }).catch((e) =>
        console.warn('Firestore missed-return complete error:', e)
      );
    }
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public getVehicle(idOrToken: string): Vehicle | undefined {
    if (!idOrToken) return undefined;
    const vehicles = this.getVehicles();
    const raw = idOrToken.trim();
    const decoded = decodeURIComponent(raw);
    const lower = decoded.toLowerCase();

    // Strip URL prefixes or app schemes if passed from QR / link
    const cleanToken = lower
      .replace(/^https?:\/\/[^/]+\/inspect\?id=/i, '')
      .replace(/^https?:\/\/[^/]+\/\?inspect=/i, '')
      .replace(/^https?:\/\/[^/]+\/inspect\//i, '')
      .replace(/^\/inspect\?id=/i, '')
      .replace(/^\/\?inspect=/i, '')
      .replace(/^\/inspect\//i, '')
      .replace(/^sunny:\/\/vehicle\//i, '')
      .split('&')[0];

    return vehicles.find(v => {
      const vid = (v.id || '').toLowerCase();
      const vToken = (v.qrCodeToken || '').toLowerCase();
      const vNum = (v.vehicleNumber || '').toLowerCase();

      return (
        vid === lower ||
        vToken === lower ||
        vNum === lower ||
        vid === cleanToken ||
        vToken === cleanToken ||
        vNum === cleanToken ||
        `sunny://vehicle/${vid}` === lower ||
        `sunny://vehicle/${vToken}` === lower
      );
    });
  }

  public getVehicleByQR(token: string): Vehicle | undefined {
    return this.getVehicle(token);
  }

  /**
   * Directly queries Firebase Firestore for a specific vehicle by ID or qrCodeToken.
   * Useful on direct URL navigation / QR scan when local storage hasn't synced yet.
   */
  public async fetchVehicleAsync(idOrToken: string): Promise<Vehicle | null> {
    if (!idOrToken) return null;
    this.init();

    // 1. Check local cache first
    const cached = this.getVehicle(idOrToken);
    if (cached) return cached;

    // 2. Fetch directly from Cloud Firestore with auth guarantee & 5s timeout
    if (db) {
      try {
        await Promise.race([
          ensureAuth(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Auth resolution timeout')), 5000))
        ]);

        const cleanId = idOrToken.trim();
        
        // Direct doc lookup by ID
        const docSnap = await Promise.race([
          getDoc(doc(db, 'vehicles', cleanId)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore getDoc timeout')), 5000))
        ]);

        if (docSnap.exists()) {
          const v = docSnap.data() as Vehicle;
          // Cache it in localStorage
          const current = this.getVehicles();
          if (!current.some(x => x.id === v.id)) {
            localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify([...current, v]));
            window.dispatchEvent(new Event('sunny_db_update'));
          }
          return v;
        }

        // Also query collection in case idOrToken matches qrCodeToken or vehicleNumber
        const allDocs = await Promise.race([
          getDocs(collection(db, 'vehicles')),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore getDocs timeout')), 5000))
        ]);

        if (!allDocs.empty) {
          const fetchedList: Vehicle[] = [];
          allDocs.forEach(d => fetchedList.push(d.data() as Vehicle));
          localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(fetchedList));
          window.dispatchEvent(new Event('sunny_db_update'));
          return this.getVehicle(idOrToken) || null;
        }
      } catch (err) {
        console.warn('Direct Firestore vehicle query failed or timed out:', err);
      }
    }

    return null;
  }

  public async createVehicle(
    vehicleData: Partial<Vehicle> & { vehicleNumber: string; name: string; licensePlate: string },
    initialEquipmentNames?: string[]
  ): Promise<Vehicle> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const timestamp = Date.now();
    const vehicleId = vehicleData.id || `van-${timestamp}`;
    const qrCodeToken = vehicleData.qrCodeToken || vehicleId;
    const nowIso = new Date().toISOString();

    const newVehicle: Vehicle = {
      id: vehicleId,
      vehicleNumber: vehicleData.vehicleNumber.trim(),
      name: vehicleData.name.trim(),
      licensePlate: vehicleData.licensePlate.trim().toUpperCase(),
      qrCodeToken: qrCodeToken.trim(),
      status: vehicleData.status || 'active',
      currentUserId: vehicleData.currentUserId || null,
      currentUserName: vehicleData.currentUserName || null,
      currentUserStartTime: vehicleData.currentUserStartTime || null,
      currentUserStartAt: vehicleData.currentUserStartAt || null,
      lastInspectionId: vehicleData.lastInspectionId || null,
      lastInspectionStatus: vehicleData.lastInspectionStatus || null,
      lastInspectionAt: vehicleData.lastInspectionAt || null,
      imageUrl: vehicleData.imageUrl?.trim() || null,
      createdAt: vehicleData.createdAt || nowIso,
    };

    // Save vehicle locally
    const currentVehicles = this.getVehicles();
    const updatedVehicles = [...currentVehicles, newVehicle];
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(updatedVehicles));

    // Create associated equipment records if provided
    const newEquipmentList: Equipment[] = [];
    if (initialEquipmentNames && initialEquipmentNames.length > 0) {
      initialEquipmentNames
        .map(n => n.trim())
        .filter(n => n.length > 0)
        .forEach((name, idx) => {
          const eq: Equipment = {
            id: `eq-${timestamp}-${idx}`,
            vehicleId: newVehicle.id,
            vehicleNumber: newVehicle.vehicleNumber,
            name,
            category: 'equipment',
            status: 'working',
            activeIssueId: null,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          newEquipmentList.push(eq);
        });

      if (newEquipmentList.length > 0) {
        const currentEquipment = this.getEquipment();
        const updatedEquipment = [...currentEquipment, ...newEquipmentList];
        localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(updatedEquipment));
      }
    }

    // Sync to Firestore
    if (db) {
      try {
        await setDoc(doc(db, 'vehicles', newVehicle.id), sanitizeForFirestore(newVehicle));
        for (const eq of newEquipmentList) {
          await setDoc(doc(db, 'equipment', eq.id), sanitizeForFirestore(eq));
        }
      } catch (e) {
        console.warn('Firestore create vehicle write fallback to local cache:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return newVehicle;
  }

  public async updateVehicle(updated: Vehicle): Promise<Vehicle> {
    if (!this.isClient()) return updated;
    const sanitized = sanitizeForFirestore(updated);
    const vehicles = this.getVehicles().map(v => v.id === updated.id ? sanitized : v);
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));

    // Also update vehicleNumber on any assigned equipment
    const equipment = this.getEquipment().map(eq => {
      const assignments = (eq.assignments || []).map(a =>
        a.vehicleId === updated.id ? { ...a, vehicleNumber: updated.vehicleNumber } : a
      );
      if (eq.vehicleId === updated.id || assignments.some((a, i) => a.vehicleId === updated.id && a.vehicleNumber !== (eq.assignments || [])[i]?.vehicleNumber)) {
        return { ...eq, vehicleNumber: updated.vehicleNumber, assignments };
      }
      return { ...eq, assignments };
    });
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));

    // Cascade vehicleNumber update to linked issues
    const currentIssues = this.getIssues();
    let issuesChanged = false;
    const updatedIssues = currentIssues.map(iss => {
      if (iss.vehicleId === updated.id && iss.vehicleNumber !== updated.vehicleNumber) {
        issuesChanged = true;
        return { ...iss, vehicleNumber: updated.vehicleNumber };
      }
      return iss;
    });
    if (issuesChanged) {
      localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(updatedIssues));
    }

    // Cascade vehicleNumber update to linked inspections
    const currentInspections = this.getInspections();
    let inspectionsChanged = false;
    const updatedInspections = currentInspections.map(insp => {
      if (insp.vehicleId === updated.id && insp.vehicleNumber !== updated.vehicleNumber) {
        inspectionsChanged = true;
        return { ...insp, vehicleNumber: updated.vehicleNumber };
      }
      return insp;
    });
    if (inspectionsChanged) {
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(updatedInspections));
    }

    window.dispatchEvent(new Event('sunny_db_update'));

    // Sync to Firestore
    try {
      if (db) {
        await setDoc(doc(db, 'vehicles', updated.id), sanitized, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore write vehicle fallback to local cache:', e);
    }
    return sanitized;
  }

  public async checkInVehicle(vehicleId: string): Promise<Vehicle> {
    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle) throw new Error('Vehicle not found');
    return this.updateVehicle(checkInFields(vehicle));
  }

  /** Manager occupancy reset. Clears every driver; does not create missed-return nags. */
  public async returnAllInUseVehicles(): Promise<{ count: number }> {
    if (!this.isClient()) return { count: 0 };
    this.init();
    const list = this.readVehicleList();
    let count = 0;
    const clearedIds = new Set<string>();
    const next = list.map((v) => {
      if (!v.currentUserId) return v;
      count += 1;
      clearedIds.add(v.id);
      return checkInFields(v);
    });
    if (count === 0) return { count: 0 };
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(next));
    window.dispatchEvent(new Event('sunny_db_update'));
    if (db) {
      next.forEach((v) => {
        if (!clearedIds.has(v.id)) return;
        setDoc(doc(db, 'vehicles', v.id), sanitizeForFirestore(v), { merge: true }).catch((e) =>
          console.warn('Firestore return-all write error:', e)
        );
      });
    }
    return { count };
  }

  public async checkOutVehicle(vehicleId: string, user: { id: string; name: string }): Promise<Vehicle> {
    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle) throw new Error('Vehicle not found');
    return this.updateVehicle(checkOutFields(vehicle, user));
  }

  public async deleteVehicle(
    vehicleId: string,
    options?: { equipmentMode: 'return_to_shop' | 'delete_associated' }
  ): Promise<void> {
    if (!this.isClient()) return;
    const mode = options?.equipmentMode || 'return_to_shop';

    const vehicles = this.getVehicles().filter(v => v.id !== vehicleId);
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));

    let equipment = this.getEquipment();
    const deletedEquipmentIds: string[] = [];
    const modifiedEquipment: Equipment[] = [];
    if (mode === 'return_to_shop') {
      equipment = equipment.map(e => {
        if (!(e.assignments || []).some(a => a.vehicleId === vehicleId)) return e;
        const assignments = (e.assignments || []).filter(a => a.vehicleId !== vehicleId);
        const total = e.totalQuantity ?? 0;
        const updated = {
          ...e,
          assignments,
          vehicleId: assignments[0]?.vehicleId || null,
          vehicleNumber: assignments[0]?.vehicleNumber || 'Unassigned',
          availableQuantity: Math.max(0, total - assignments.reduce((sum, a) => sum + a.quantity, 0)),
        };
        modifiedEquipment.push(updated);
        return updated;
      });
    } else {
      equipment = equipment.flatMap(e => {
        const assignments = e.assignments || [];
        const total = e.totalQuantity ?? 0;
        const assignedTotal = assignments.reduce((sum, a) => sum + a.quantity, 0);
        const shopBefore = Math.max(0, total - assignedTotal);
        const qtyOnVehicle = assignments
          .filter(a => a.vehicleId === vehicleId)
          .reduce((sum, a) => sum + a.quantity, 0);
        const onlyOnThisVehicle =
          assignments.length > 0 &&
          assignments.every(a => a.vehicleId === vehicleId);
        const allUnitsOnThisVehicle = onlyOnThisVehicle && assignedTotal === total;
        if (allUnitsOnThisVehicle) {
          deletedEquipmentIds.push(e.id);
          return [];
        }
        if (qtyOnVehicle === 0) return [e];
        const nextAssignments = assignments.filter(a => a.vehicleId !== vehicleId);
        const nextTotal =
          shopBefore > 0 && onlyOnThisVehicle
            ? Math.max(0, total - qtyOnVehicle)
            : total;
        const nextAssigned = nextAssignments.reduce((sum, a) => sum + a.quantity, 0);
        const updated = {
          ...e,
          totalQuantity: nextTotal,
          assignments: nextAssignments,
          vehicleId: nextAssignments[0]?.vehicleId || null,
          vehicleNumber: nextAssignments[0]?.vehicleNumber || 'Unassigned',
          availableQuantity: Math.max(0, nextTotal - nextAssigned),
        };
        modifiedEquipment.push(updated);
        return [updated];
      });
    }
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));

    const inspections = this.getInspections().filter(i => i.vehicleId !== vehicleId);
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(inspections));
    const issues = this.getIssues().filter(i => i.vehicleId !== vehicleId);
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

    if (db) {
      const writes: Array<{ label: string; operation: Promise<unknown> }> = [
        {
          label: `delete vehicle ${vehicleId}`,
          operation: deleteDoc(doc(db, 'vehicles', vehicleId)),
        },
        ...modifiedEquipment.map(item => ({
          label: `update equipment ${item.id}`,
          operation: setDoc(
            doc(db, 'equipment', item.id),
            sanitizeForFirestore(item),
            { merge: true },
          ),
        })),
        ...(
          mode === 'delete_associated'
            ? deletedEquipmentIds.map(equipmentId => ({
                label: `delete equipment ${equipmentId}`,
                operation: deleteDoc(doc(db, 'equipment', equipmentId)),
              }))
            : []
        ),
      ];
      const results = await Promise.allSettled(writes.map(write => write.operation));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`Firestore ${writes[index].label} failed:`, result.reason);
        }
      });
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }

  // ==========================================
  // EQUIPMENT (Manager CRUD)
  // ==========================================
  public getEquipment(): Equipment[] {
    if (!this.isClient()) return [];
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
    return data ? (JSON.parse(data) as Equipment[]).map(eq => this.normalizeEquipment(eq)) : [];
  }

  public getEquipmentItem(id: string): Equipment | undefined {
    return this.getEquipment().find(e => e.id === id);
  }

  public getEquipmentForVehicle(vehicleId: string): Equipment[] {
    return this.getEquipment().filter(e => e.vehicleId === vehicleId || e.assignments?.some(a => a.vehicleId === vehicleId));
  }

  public getGlobalInventorySummary() {
    const items = this.getEquipment();
    const totalOwned = items.reduce((sum, item) => sum + (item.totalQuantity ?? 1), 0);
    const assigned = items.reduce((sum, item) => sum + (item.assignments || []).reduce((qty, assignment) => qty + assignment.quantity, 0), 0);
    const unassigned = Math.max(0, totalOwned - assigned);
    return { totalOwned, assigned, unassigned };
  }

  public getAssignableFromShop(): Equipment[] {
    return this.getEquipment()
      .filter(item => (item.availableQuantity ?? 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async createEquipment(equipmentData: {
    name: string;
    assetTag?: string | null;
    vehicleId?: string | null;
    category?: EquipmentCategory;
    status?: Equipment['status'];
    kind?: EquipmentKind;
    totalQuantity?: number;
    minRequiredStock?: number;
    lowWearThresholdPercent?: number;
    qrCodeToken?: string | null;
    qrCode?: string | null;
    toolFamily?: string | null;
    lifespanEnabled?: boolean;
    lifespanMode?: LifespanMode | null;
    expectedCars?: number | null;
    carsUsed?: number;
    expectedMonths?: number | null;
    lifeStartedAt?: string | null;
    dueDate?: string | null;
    retiredAt?: string | null;
  }): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const timestamp = Date.now();
    const targetVehicle = equipmentData.vehicleId ? this.getVehicle(equipmentData.vehicleId) : undefined;
    const nowIso = new Date().toISOString();
    const kind = equipmentData.kind || (equipmentData.category === 'supplies' ? 'consumable' : 'reusable');
    const requestedTotal = Number(equipmentData.totalQuantity);

    const lifespanEnabled = Boolean(equipmentData.lifespanEnabled);
    const lifespanMode = equipmentData.lifespanMode || null;
    const expectedCars = equipmentData.expectedCars != null ? Number(equipmentData.expectedCars) : null;
    const carsUsed = Math.max(0, Number(equipmentData.carsUsed) || 0);
    const expectedMonths = equipmentData.expectedMonths != null ? Number(equipmentData.expectedMonths) : null;
    const lifeStartedAt = equipmentData.lifeStartedAt || (lifespanEnabled && lifespanMode === 'time' ? nowIso : null);
    const dueDate = equipmentData.dueDate || (lifeStartedAt && expectedMonths ? calculateLifespanDueDate(lifeStartedAt, expectedMonths) : null);
    const retiredAt = equipmentData.retiredAt || null;
    const lifespanStatus = computeLifespanStatus({
      lifespanEnabled,
      lifespanMode,
      expectedCars,
      carsUsed,
      expectedMonths,
      lifeStartedAt,
      dueDate,
      retiredAt
    });

    // Lifespan-tracked tools are always individual assets (one QR / one life bar).
    const totalQuantity = lifespanEnabled ? 1 : Math.max(1, Number.isFinite(requestedTotal) ? Math.floor(requestedTotal) : 1);
    // New stock lands in the shop; the manager distributes it per vehicle after.
    // When creating with an optional vehicle + lifespan, assign the single unit to that van.
    const assignments = targetVehicle
      ? [{ vehicleId: targetVehicle.id, vehicleNumber: targetVehicle.vehicleNumber, quantity: 1 }]
      : [];

    const trimmedName = equipmentData.name.trim();
    const toolFamily =
      equipmentData.toolFamily?.trim() ||
      (lifespanEnabled ? stripInstanceSuffix(trimmedName) || trimmedName : null);

    const newEq: Equipment = {
      id: `eq-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
      vehicleId: targetVehicle?.id || null,
      vehicleNumber: targetVehicle ? targetVehicle.vehicleNumber : 'Unassigned',
      name: trimmedName,
      assetTag: equipmentData.assetTag?.trim() || null,
      toolFamily,
      category: equipmentData.category || 'equipment',
      kind,
      totalQuantity,
      availableQuantity: Math.max(0, totalQuantity - assignments.reduce((sum, a) => sum + a.quantity, 0)),
      assignments,
      qrCodeToken: equipmentData.qrCodeToken?.trim() || null,
      qrCode: equipmentData.qrCode?.trim() || equipmentData.qrCodeToken?.trim() || null,
      status: equipmentData.status || 'working',
      activeIssueId: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      lifespanEnabled,
      lifespanMode,
      expectedCars,
      carsUsed,
      expectedMonths,
      lifeStartedAt,
      dueDate,
      lifespanStatus,
      retiredAt,
      minRequiredStock: equipmentData.minRequiredStock !== undefined ? equipmentData.minRequiredStock : undefined,
      lowWearThresholdPercent: equipmentData.lowWearThresholdPercent !== undefined ? equipmentData.lowWearThresholdPercent : undefined
    };

    const currentList = this.getEquipment();
    const updatedList = [...currentList, newEq];
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(updatedList));

    if (db) {
      try {
        await setDoc(doc(db, 'equipment', newEq.id), sanitizeForFirestore(newEq));
      } catch (e) {
        console.warn('Firestore create equipment error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return newEq;
  }

  /**
   * Creates N separately tracked lifespan tools (each qty 1, own life bar, own QR token).
   * Use when the manager says "I own 3 brushes that each last 300 cars."
   */
  public async createLifespanTrackedUnits(
    equipmentData: {
      name: string;
      assetTag?: string | null;
      vehicleId?: string | null;
      category?: EquipmentCategory;
      status?: Equipment['status'];
      kind?: EquipmentKind;
      minRequiredStock?: number;
      lowWearThresholdPercent?: number;
      qrCodeToken?: string | null;
      lifespanMode?: LifespanMode | null;
      expectedCars?: number | null;
      expectedMonths?: number | null;
      lifeStartedAt?: string | null;
    },
    count: number
  ): Promise<Equipment[]> {
    const unitCount = Math.max(1, Math.floor(Number(count) || 1));
    const baseName = equipmentData.name.trim();
    const cleanPrefix = (equipmentData.assetTag?.trim() || baseName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'EQ');
    const created: Equipment[] = [];

    for (let i = 1; i <= unitCount; i++) {
      const unitName = formatIndividualToolName(baseName, i, unitCount);
      const tagSuffix = String(i).padStart(3, '0');
      const unitTag = `${cleanPrefix}-${tagSuffix}`;
      const unitQr = equipmentData.qrCodeToken?.trim()
        ? (unitCount > 1 ? `${equipmentData.qrCodeToken.trim()}-${i}` : equipmentData.qrCodeToken.trim())
        : unitTag.toLowerCase();

      const item = await this.createEquipment({
        ...equipmentData,
        name: unitName,
        assetTag: unitTag,
        toolFamily: baseName,
        qrCodeToken: unitQr,
        totalQuantity: 1,
        lifespanEnabled: true,
        lifespanMode: equipmentData.lifespanMode || 'usage',
        expectedCars: equipmentData.expectedCars,
        expectedMonths: equipmentData.expectedMonths,
        lifeStartedAt: equipmentData.lifeStartedAt,
        carsUsed: 0
      });
      created.push(item);
    }

    return created;
  }

  /**
   * Adds N new lifespan-tracked units to an existing tool family (shop stock, fresh life).
   * Copies settings from the template / family; renumbers active units to Label #1…#N.
   */
  public async addLifespanUnitsToFamily(templateEquipmentId: string, count: number): Promise<Equipment[]> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const unitCount = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));
    const template = this.getEquipmentItem(templateEquipmentId);
    if (!template) throw new Error('Equipment not found.');
    if (!template.lifespanEnabled) {
      throw new Error('Only lifespan-tracked tool types support Add another.');
    }

    const familyKey = getEquipmentFamilyKey(template);
    const label = getEquipmentFamilyLabel(template);
    const familyItems = this.getEquipment().filter(e => getEquipmentFamilyKey(e) === familyKey);
    const activeLifespan = familyItems.filter(e => e.lifespanEnabled && !e.retiredAt);
    const settingsSource =
      activeLifespan.find(e => e.id === template.id) || activeLifespan[0] || template;

    const cleanPrefix = (
      settingsSource.assetTag?.replace(/-\d+$/, '').trim() ||
      label.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) ||
      'EQ'
    );

    let nextTagNum = 0;
    for (const eq of familyItems) {
      const match = eq.assetTag?.match(/-(\d+)$/);
      if (match) nextTagNum = Math.max(nextTagNum, Number(match[1]));
    }

    const nowIso = new Date().toISOString();
    const created: Equipment[] = [];

    for (let i = 0; i < unitCount; i++) {
      nextTagNum += 1;
      const unitTag = `${cleanPrefix}-${String(nextTagNum).padStart(3, '0')}`;
      const item = await this.createEquipment({
        name: label,
        assetTag: unitTag,
        toolFamily: label,
        category: settingsSource.category,
        kind: settingsSource.kind,
        status: 'working',
        totalQuantity: 1,
        lowWearThresholdPercent: settingsSource.lowWearThresholdPercent,
        qrCodeToken: unitTag.toLowerCase(),
        lifespanEnabled: true,
        lifespanMode: settingsSource.lifespanMode || 'usage',
        expectedCars: settingsSource.expectedCars,
        expectedMonths: settingsSource.expectedMonths,
        lifeStartedAt: settingsSource.lifespanMode === 'time' ? nowIso : null,
        carsUsed: 0
      });
      created.push(item);
    }

    const activeAfter = this.getEquipment()
      .filter(e => getEquipmentFamilyKey(e) === familyKey && e.lifespanEnabled && !e.retiredAt)
      .slice()
      .sort((a, b) => {
        const ca = a.createdAt || '';
        const cb = b.createdAt || '';
        if (ca !== cb) return ca.localeCompare(cb);
        return a.id.localeCompare(b.id);
      });

    const total = activeAfter.length;
    for (let i = 0; i < activeAfter.length; i++) {
      const eq = activeAfter[i];
      const newName = formatIndividualToolName(label, i + 1, total);
      if (eq.name === newName && (eq.toolFamily || '') === label) continue;
      await this.updateEquipment({
        ...eq,
        name: newName,
        toolFamily: label
      });
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return created.map(c => this.getEquipmentItem(c.id)).filter((c): c is Equipment => Boolean(c));
  }

  /**
   * Splits a multi-qty lifespan SKU into individual qty-1 tools with their own life bars.
   * Distributes existing van assignments one unit at a time; leftover stock stays in the shop.
   * Removes the original shared record.
   */
  public async splitLifespanEquipmentIntoIndividuals(equipmentId: string): Promise<Equipment[]> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const source = this.getEquipmentItem(equipmentId);
    if (!source) throw new Error('Equipment not found.');
    if (!source.lifespanEnabled) {
      throw new Error('Only lifespan-tracked equipment can be split into individual tools.');
    }
    if (!isMultiQtyLifespanItem(source)) {
      throw new Error('This tool is already tracked as a single unit.');
    }

    const assignedSlots: Array<{ vehicleId: string; vehicleNumber: string }> = [];
    for (const assignment of source.assignments || []) {
      for (let i = 0; i < assignment.quantity; i++) {
        assignedSlots.push({ vehicleId: assignment.vehicleId, vehicleNumber: assignment.vehicleNumber });
      }
    }

    const assignedTotal = assignedSlots.length;
    const total = Math.max(source.totalQuantity ?? 1, assignedTotal);
    const shopCount = Math.max(0, total - assignedTotal);

    const baseName = source.name.replace(/\s+#\d+$/, '').trim() || source.name;
    const baseTag = source.assetTag?.replace(/-\d+$/, '').trim() || '';
    const created: Equipment[] = [];

    const makeUnit = async (index: number, vehicleId: string | null) => {
      const unitName = formatIndividualToolName(baseName, index, total);
      const unitTag = total > 1 ? (baseTag ? `${baseTag}-${index}` : null) : (baseTag || null);
      const item = await this.createEquipment({
        name: unitName,
        assetTag: unitTag,
        toolFamily: baseName,
        vehicleId,
        category: source.category,
        kind: source.kind,
        status: source.status,
        totalQuantity: 1,
        qrCodeToken: null,
        lifespanEnabled: true,
        lifespanMode: source.lifespanMode,
        expectedCars: source.expectedCars,
        carsUsed: 0,
        expectedMonths: source.expectedMonths,
        lifeStartedAt: source.lifeStartedAt,
        dueDate: source.dueDate
      });
      created.push(item);
    };

    let index = 1;
    for (const slot of assignedSlots) {
      await makeUnit(index, slot.vehicleId);
      index += 1;
    }
    for (let s = 0; s < shopCount; s++) {
      await makeUnit(index, null);
      index += 1;
    }

    await this.deleteEquipment(equipmentId);
    window.dispatchEvent(new Event('sunny_db_update'));
    return created;
  }

  public async updateEquipment(updated: Equipment): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const targetVehicle = updated.vehicleId ? this.getVehicle(updated.vehicleId) : undefined;
    let normalized = this.normalizeEquipment(updated);

    // Lifespan tools must stay individual (qty 1). Refuse silent multi-qty lifespan saves.
    if (normalized.lifespanEnabled) {
      const assigned = (normalized.assignments || []).reduce((sum, a) => sum + a.quantity, 0);
      if (assigned > 1 || (normalized.totalQuantity ?? 1) > 1) {
        throw new Error(
          'Lifespan-tracked tools must be individual units (quantity 1). Split this item into separate tools first.'
        );
      }
      normalized = {
        ...normalized,
        totalQuantity: 1,
        availableQuantity: Math.max(0, 1 - assigned),
        assignments: (normalized.assignments || []).map(a => ({ ...a, quantity: Math.min(1, a.quantity) }))
      };
    }

    const enriched: Equipment = {
      ...normalized,
      vehicleNumber: targetVehicle ? targetVehicle.vehicleNumber : updated.vehicleNumber || 'Unassigned',
      vehicleId: targetVehicle?.id || normalized.vehicleId || null,
      updatedAt: new Date().toISOString()
    };

    const sanitized = sanitizeForFirestore(enriched);
    const currentList = this.getEquipment();
    const updatedList = currentList.map(e => e.id === updated.id ? sanitized : e);
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(updatedList));

    // Cascade equipmentName update to linked issues
    const currentIssues = this.getIssues();
    let issuesChanged = false;
    const updatedIssues = currentIssues.map(iss => {
      if (iss.equipmentId === updated.id && iss.equipmentName !== enriched.name) {
        issuesChanged = true;
        return { ...iss, equipmentName: enriched.name };
      }
      return iss;
    });
    if (issuesChanged) {
      localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(updatedIssues));
    }

    if (db) {
      try {
        await setDoc(doc(db, 'equipment', updated.id), sanitized, { merge: true });
      } catch (e) {
        console.warn('Firestore update equipment error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return sanitized;
  }

  // ==========================================
  // EQUIPMENT LIFESPAN & DUE FOR REVIEW
  // ==========================================
  public getDueForReviewEquipment(): Equipment[] {
    return this.getEquipment().filter(
      eq => eq.lifespanEnabled && !eq.retiredAt && eq.lifespanStatus === 'due_for_review'
    );
  }

  public getLifespanAlertsEquipment(): Equipment[] {
    return this.getEquipment().filter(
      eq => eq.lifespanEnabled && !eq.retiredAt && (eq.lifespanStatus === 'due_for_review' || eq.lifespanStatus === 'getting_low')
    );
  }

  public async extendEquipmentLifespan(
    equipmentId: string,
    extensionAmount: number,
    meta?: { userId?: string | null; userName?: string | null; reason?: string }
  ): Promise<Equipment> {
    const item = this.getEquipmentItem(equipmentId);
    if (!item) throw new Error('Equipment not found.');
    const updated = extendLifespan(item, extensionAmount, meta);
    return this.updateEquipment(updated);
  }

  public async replaceEquipmentLifespan(
    equipmentId: string,
    meta?: { userId?: string | null; userName?: string | null; reason?: string }
  ): Promise<Equipment> {
    const item = this.getEquipmentItem(equipmentId);
    if (!item) throw new Error('Equipment not found.');
    const updated = replaceLifespan(item, meta);
    return this.updateEquipment(updated);
  }

  public async batchReplaceLifespan(
    equipmentIds: string[],
    meta?: { userId?: string | null; userName?: string | null; reason?: string }
  ): Promise<Equipment[]> {
    const results: Equipment[] = [];
    for (const id of equipmentIds) {
      const item = this.getEquipmentItem(id);
      if (item && item.lifespanEnabled && !item.retiredAt) {
        const updated = replaceLifespan(item, {
          userId: meta?.userId,
          userName: meta?.userName,
          reason: meta?.reason || 'Batch replaced',
        });
        const saved = await this.updateEquipment(updated);
        results.push(saved);
      }
    }
    return results;
  }

  public async retireEquipment(
    equipmentId: string,
    meta?: { userId?: string | null; userName?: string | null; reason?: string }
  ): Promise<Equipment> {
    const item = this.getEquipmentItem(equipmentId);
    if (!item) throw new Error('Equipment not found.');
    const updated = retireLifespan(item, meta);
    return this.updateEquipment(updated);
  }

  public async unretireEquipment(
    equipmentId: string,
    meta?: {
      userId?: string | null;
      userName?: string | null;
      reason?: string;
      restoreStatus?: 'working' | 'flagged';
    }
  ): Promise<Equipment> {
    const item = this.getEquipmentItem(equipmentId);
    if (!item) throw new Error('Equipment not found.');
    if (!item.retiredAt) throw new Error('Equipment is not retired.');
    const updated = unretireLifespan(item, meta);
    return this.updateEquipment(updated);
  }

  public getVehicleAvgDailyJobs(vehicleId: string): number {
    const logs = this.getVehicleDayLogs().filter(l => l.vehicleId === vehicleId && l.jobsCount > 0);
    if (logs.length === 0) return 3.5; // Fleet typical average
    const total = logs.reduce((sum, l) => sum + l.jobsCount, 0);
    return Math.max(0.5, total / logs.length);
  }

  // ==========================================
  // VEHICLE DAILY JOB LOGS & WEAR TRACKING
  // ==========================================
  public getVehicleDayLogs(): VehicleDayLog[] {
    if (!this.isClient()) return [];
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.VEHICLE_DAY_LOGS);
    return data ? (JSON.parse(data) as VehicleDayLog[]) : [];
  }

  public getVehicleDayLog(vehicleId: string, dateString?: string): VehicleDayLog | undefined {
    const targetDate = dateString || this.getTodayDateString();
    return this.getVehicleDayLogs().find(
      log => log.vehicleId === vehicleId && log.dateString === targetDate
    );
  }

  public getTodayJobsCount(vehicleId: string): number {
    const log = this.getVehicleDayLog(vehicleId);
    return log ? Math.max(0, log.jobsCount) : 0;
  }

  public getTodayDateString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  public async setVehicleJobsToday(
    vehicleId: string,
    newJobsCount: number,
    user?: { id: string; name: string } | null
  ): Promise<VehicleDayLog> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle) throw new Error('Vehicle not found.');

    const clampedJobs = Math.max(0, Math.floor(Number(newJobsCount) || 0));
    const todayString = this.getTodayDateString();
    const logId = `${vehicleId}_${todayString}`;
    const nowIso = new Date().toISOString();

    const existingLogs = this.getVehicleDayLogs();
    const existingLog = existingLogs.find(l => l.id === logId || (l.vehicleId === vehicleId && l.dateString === todayString));
    const oldJobsCount = existingLog ? Math.max(0, existingLog.jobsCount) : 0;
    const delta = clampedJobs - oldJobsCount;

    const updatedLog: VehicleDayLog = {
      id: logId,
      vehicleId,
      dateString: todayString,
      jobsCount: clampedJobs,
      updatedAt: nowIso,
      updatedById: user?.id || null,
      updatedByName: user?.name || null
    };

    const newLogs = existingLogs.some(l => l.id === logId)
      ? existingLogs.map(l => (l.id === logId ? updatedLog : l))
      : [...existingLogs, updatedLog];

    localStorage.setItem(STORAGE_KEYS.VEHICLE_DAY_LOGS, JSON.stringify(newLogs));

    if (db) {
      try {
        await setDoc(doc(db, 'vehicleDayLogs', logId), sanitizeForFirestore(updatedLog));
      } catch (e) {
        console.warn('Firestore vehicleDayLogs write error:', e);
      }
    }

    // Apply delta wear to all active, usage-mode tools assigned to this vehicle
    if (delta !== 0) {
      const allEquipment = this.getEquipment();
      const updatedEquipmentList = allEquipment.map(eq => {
        const isAssigned = eq.vehicleId === vehicleId || (eq.assignments && eq.assignments.some(a => a.vehicleId === vehicleId));
        if (isAssigned && eq.lifespanEnabled && eq.lifespanMode === 'usage' && !eq.retiredAt) {
          const newCarsUsed = Math.max(0, (eq.carsUsed || 0) + delta);
          const updatedEq: Equipment = {
            ...eq,
            carsUsed: newCarsUsed,
            updatedAt: nowIso
          };
          updatedEq.lifespanStatus = computeLifespanStatus(updatedEq);
          if (db) {
            setDoc(doc(db, 'equipment', updatedEq.id), sanitizeForFirestore(updatedEq), { merge: true }).catch(err => {
              console.warn('Firestore equipment wear update error:', err);
            });
          }
          return updatedEq;
        }
        return eq;
      });

      localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(updatedEquipmentList));
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return updatedLog;
  }

  public getEquipmentByQR(token: string): Equipment | undefined {
    const raw = decodeURIComponent((token || '').trim());
    let clean = raw
      .replace(/^https?:\/\/[^/]+\/equipment\/scan\?id=/i, '')
      .replace(/^\/equipment\/scan\?id=/i, '')
      .replace(/^sunny:\/\/equipment\//i, '')
      .split('&')[0];
    try {
      const parsed = new URL(raw);
      clean = parsed.searchParams.get('id') || parsed.searchParams.get('equipment') || parsed.pathname.split('/').filter(Boolean).pop() || clean;
    } catch {
      // Token is commonly a short ID rather than a full URL.
    }
    return this.getEquipment().find(eq =>
      [eq.id, eq.qrCodeToken, eq.qrCode].filter(Boolean).some(value => String(value).toLowerCase() === clean.toLowerCase())
    );
  }

  public async fetchEquipmentAsync(idOrToken: string): Promise<Equipment | null> {
    this.init();
    const cached = this.getEquipmentItem(idOrToken) || this.getEquipmentByQR(idOrToken);
    if (cached) return cached;
    if (!db) return null;
    try {
      await Promise.race([ensureAuth(), new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 5000))]);
      const direct = await getDoc(doc(db, 'equipment', idOrToken));
      if (direct.exists()) {
        const item = this.normalizeEquipment(direct.data() as Equipment);
        const current = this.getEquipment().filter(eq => eq.id !== item.id);
        localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify([...current, item]));
        window.dispatchEvent(new Event('sunny_db_update'));
        return item;
      }
      const snapshot = await getDocs(collection(db, 'equipment'));
      const items: Equipment[] = [];
      snapshot.forEach(d => items.push(this.normalizeEquipment(d.data() as Equipment)));
      const needle = idOrToken.toLowerCase();
      const match = items.find(item => [item.id, item.qrCodeToken, item.qrCode, item.qrToken].filter(Boolean).some(value => String(value).toLowerCase() === needle));
      if (items.length) localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(items));
      return match || null;
    } catch (error) {
      console.warn('Direct Firestore equipment query failed:', error);
      return null;
    }
  }

  public async transferEquipmentQuantity(
    equipmentId: string,
    targetVehicleId: string,
    quantity: number,
    sourceVehicleId?: string | null
  ): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    const equipment = this.getEquipmentItem(equipmentId);
    const vehicle = this.getVehicle(targetVehicleId);
    if (!equipment || !vehicle) throw new Error('Equipment or target vehicle not found.');
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Quantity must be a positive whole number.');

    const kind = equipment.kind || 'reusable';
    const assignments = [...(equipment.assignments || [])];
    const sourceIndex = sourceVehicleId ? assignments.findIndex(a => a.vehicleId === sourceVehicleId) : -1;
    const sourceAvailable = sourceVehicleId
      ? (sourceIndex >= 0 ? assignments[sourceIndex].quantity : 0)
      : (equipment.availableQuantity ?? 0);
    if (amount > sourceAvailable) throw new Error('Not enough available equipment quantity.');

    if (sourceVehicleId && sourceIndex >= 0) {
      assignments[sourceIndex] = { ...assignments[sourceIndex], quantity: assignments[sourceIndex].quantity - amount };
    }
    const targetIndex = assignments.findIndex(a => a.vehicleId === targetVehicleId);
    if (targetIndex >= 0) {
      assignments[targetIndex] = { ...assignments[targetIndex], vehicleNumber: vehicle.vehicleNumber, quantity: assignments[targetIndex].quantity + amount };
    } else {
      assignments.push({ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, quantity: amount });
    }
    const cleanAssignments = assignments.filter(a => a.quantity > 0);
    const totalQuantity = equipment.totalQuantity ?? amount;
    const assignedQuantity = cleanAssignments.reduce((sum, a) => sum + a.quantity, 0);
    return this.updateEquipment({
      ...equipment,
      kind,
      totalQuantity: Math.max(totalQuantity, assignedQuantity),
      availableQuantity: Math.max(0, totalQuantity - assignedQuantity),
      assignments: cleanAssignments,
      vehicleId: cleanAssignments[0]?.vehicleId || null,
      vehicleNumber: cleanAssignments[0]?.vehicleNumber || 'Unassigned'
    });
  }

  public async returnEquipmentToShop(
    equipmentId: string,
    vehicleId: string,
    quantity: number
  ): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    const equipment = this.getEquipmentItem(equipmentId);
    if (!equipment) throw new Error('Equipment not found.');
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Quantity must be a positive whole number.');
    }
    const assignments = [...(equipment.assignments || [])];
    const index = assignments.findIndex(a => a.vehicleId === vehicleId);
    if (index < 0) throw new Error('No assignment on that vehicle.');
    const held = assignments[index].quantity;
    if (amount > held) throw new Error(`Only ${held} on that vehicle.`);
    assignments[index] = { ...assignments[index], quantity: held - amount };
    const cleanAssignments = assignments.filter(a => a.quantity > 0);
    const totalQuantity = equipment.totalQuantity ?? 0;
    const assignedQuantity = cleanAssignments.reduce((sum, a) => sum + a.quantity, 0);
    return this.updateEquipment({
      ...equipment,
      assignments: cleanAssignments,
      availableQuantity: Math.max(0, totalQuantity - assignedQuantity),
      vehicleId: cleanAssignments[0]?.vehicleId || null,
      vehicleNumber: cleanAssignments[0]?.vehicleNumber || 'Unassigned',
    });
  }

  public async setVehicleAssignmentQuantity(
    equipmentId: string,
    vehicleId: string,
    quantity: number
  ): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    const equipment = this.getEquipmentItem(equipmentId);
    const vehicle = this.getVehicle(vehicleId);
    if (!equipment || !vehicle) throw new Error('Equipment or vehicle not found.');
    const nextQty = Number(quantity);
    if (!Number.isInteger(nextQty) || nextQty < 0) {
      throw new Error('Quantity must be a whole number >= 0.');
    }
    const assignments = [...(equipment.assignments || [])];
    const index = assignments.findIndex(a => a.vehicleId === vehicleId);
    const current = index >= 0 ? assignments[index].quantity : 0;
    const delta = nextQty - current;
    const totalQuantity = equipment.totalQuantity ?? 0;
    const assignedOthers = assignments
      .filter(a => a.vehicleId !== vehicleId)
      .reduce((sum, a) => sum + a.quantity, 0);
    const shop = Math.max(0, totalQuantity - (assignedOthers + current));

    if (delta > 0 && delta > shop) {
      throw new Error(`Only ${shop} available in shop.`);
    }

    if (nextQty === 0) {
      const clean = assignments.filter(a => a.vehicleId !== vehicleId);
      const assignedQuantity = clean.reduce((sum, a) => sum + a.quantity, 0);
      return this.updateEquipment({
        ...equipment,
        assignments: clean,
        availableQuantity: Math.max(0, totalQuantity - assignedQuantity),
        vehicleId: clean[0]?.vehicleId || null,
        vehicleNumber: clean[0]?.vehicleNumber || 'Unassigned',
      });
    }

    if (index >= 0) {
      assignments[index] = {
        ...assignments[index],
        vehicleNumber: vehicle.vehicleNumber,
        quantity: nextQty,
      };
    } else {
      assignments.push({
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        quantity: nextQty,
      });
    }
    const cleanAssignments = assignments.filter(a => a.quantity > 0);
    const assignedQuantity = cleanAssignments.reduce((sum, a) => sum + a.quantity, 0);
    return this.updateEquipment({
      ...equipment,
      assignments: cleanAssignments,
      availableQuantity: Math.max(0, totalQuantity - assignedQuantity),
      vehicleId: cleanAssignments[0]?.vehicleId || null,
      vehicleNumber: cleanAssignments[0]?.vehicleNumber || 'Unassigned',
    });
  }

  public async setAssignmentRequiredQuantity(
    equipmentId: string,
    vehicleId: string,
    requiredQuantity: number
  ): Promise<Equipment> {
    const equipment = this.getEquipmentItem(equipmentId);
    if (!equipment) throw new Error('Equipment not found.');
    const req = Number(requiredQuantity);
    if (!Number.isInteger(req) || req < 0) {
      throw new Error('Required quantity must be a whole number >= 0.');
    }
    const assignments = (equipment.assignments || []).map(a =>
      a.vehicleId === vehicleId ? { ...a, requiredQuantity: req } : a
    );
    if (!assignments.some(a => a.vehicleId === vehicleId)) {
      throw new Error('No assignment on that vehicle.');
    }
    return this.updateEquipment({ ...equipment, assignments });
  }

  /**
   * Records consumable stock as used up on a vehicle. The amount leaves both the
   * vehicle's allocation and the global total, because it is physically gone —
   * so global inventory keeps reflecting what the fleet actually owns.
   *
   * Pass a null vehicleId to consume straight from shop stock.
   */
  public async consumeEquipmentQuantity(
    equipmentId: string,
    vehicleId: string | null,
    quantity: number
  ): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    const equipment = this.getEquipmentItem(equipmentId);
    if (!equipment) throw new Error('Equipment not found.');
    if ((equipment.kind || 'reusable') !== 'consumable') {
      throw new Error('Only consumable stock can be marked as used. Reusable equipment is transferred instead.');
    }

    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Quantity used must be a positive whole number.');
    }

    const assignments = [...(equipment.assignments || [])];
    const total = equipment.totalQuantity || 0;

    if (vehicleId) {
      const index = assignments.findIndex(a => a.vehicleId === vehicleId);
      const held = index >= 0 ? assignments[index].quantity : 0;
      if (amount > held) throw new Error(`Only ${held} on that vehicle.`);
      assignments[index] = { ...assignments[index], quantity: held - amount };
    } else {
      const shop = Math.max(0, total - assignments.reduce((sum, a) => sum + a.quantity, 0));
      if (amount > shop) throw new Error(`Only ${shop} in shop stock.`);
    }

    const cleanAssignments = assignments.filter(a => a.quantity > 0);
    const newTotal = Math.max(0, total - amount);
    const assignedQuantity = cleanAssignments.reduce((sum, a) => sum + a.quantity, 0);

    return this.updateEquipment({
      ...equipment,
      totalQuantity: newTotal,
      availableQuantity: Math.max(0, newTotal - assignedQuantity),
      assignments: cleanAssignments,
      vehicleId: cleanAssignments[0]?.vehicleId || null,
      vehicleNumber: cleanAssignments[0]?.vehicleNumber || 'Unassigned'
    });
  }

  /** Adds newly purchased stock into the shop pool. */
  public async restockEquipment(equipmentId: string, quantity: number): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    const equipment = this.getEquipmentItem(equipmentId);
    if (!equipment) throw new Error('Equipment not found.');

    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Restock amount must be a positive whole number.');
    }

    const newTotal = (equipment.totalQuantity || 0) + amount;
    const assignedQuantity = (equipment.assignments || []).reduce((sum, a) => sum + a.quantity, 0);
    return this.updateEquipment({
      ...equipment,
      totalQuantity: newTotal,
      availableQuantity: Math.max(0, newTotal - assignedQuantity)
    });
  }

  public async assignEquipmentToVehicle(equipmentId: string, vehicleId: string, quantity = 1): Promise<Equipment> {
    return this.transferEquipmentQuantity(equipmentId, vehicleId, quantity);
  }

  public async reassignEquipment(equipmentId: string, vehicleId: string, sourceVehicleId?: string | null): Promise<Equipment> {
    const equipment = this.getEquipmentItem(equipmentId);
    if (!equipment) throw new Error('Equipment not found.');
    return this.transferEquipmentQuantity(
      equipmentId,
      vehicleId,
      equipment.kind === 'consumable' ? 1 : 1,
      sourceVehicleId || equipment.assignments?.[0]?.vehicleId || null
    );
  }

  public async batchTransferEquipment(
    transfers: Array<{ equipmentId: string; quantity: number }>,
    targetVehicleId: string
  ): Promise<Equipment[]> {
    const vehicle = this.getVehicle(targetVehicleId);
    if (!vehicle) throw new Error('Target vehicle not found.');
    const results: Equipment[] = [];
    for (const item of transfers) {
      const res = await this.transferEquipmentQuantity(item.equipmentId, targetVehicleId, item.quantity);
      results.push(res);
    }
    return results;
  }

  /**
   * Bulk-imports equipment in one pass, so a 40-item AI import is a single
   * localStorage write plus one Firestore batch rather than 40 round trips.
   *
   * 'append' keeps existing stock and renames colliding ids; 'replace' discards
   * the current inventory outright, including every per-vehicle assignment.
   */
  public async importEquipment(
    items: Array<Partial<Equipment> & { name: string }>,
    mode: 'append' | 'replace'
  ): Promise<Equipment[]> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const existing = mode === 'append' ? this.getEquipment() : [];
    const usedIds = new Set(existing.map(eq => eq.id));
    const nowIso = new Date().toISOString();
    const stamp = Date.now();

    const created: Equipment[] = items.map((item, index) => {
      let id = item.id?.trim() || `eq-${stamp}-${index}`;
      if (usedIds.has(id)) id = `${id}-${stamp}-${index}`;
      usedIds.add(id);

      const kind: EquipmentKind = item.kind || (item.category === 'supplies' ? 'consumable' : 'reusable');
      const totalQuantity = Math.max(1, Number(item.totalQuantity) || 1);

      return this.normalizeEquipment({
        id,
        name: item.name.trim(),
        assetTag: item.assetTag?.trim() || null,
        category: item.category || 'equipment',
        kind,
        totalQuantity,
        // Imported stock starts unassigned; the manager distributes it per truck.
        availableQuantity: totalQuantity,
        assignments: [],
        vehicleId: null,
        vehicleNumber: 'Unassigned',
        qrCodeToken: item.qrCodeToken?.trim() || null,
        qrCode: item.qrCode?.trim() || null,
        status: item.status || 'working',
        activeIssueId: null,
        createdAt: nowIso,
        updatedAt: nowIso
      } as Equipment);
    });

    const merged = [...existing, ...created];
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(merged));

    if (db) {
      try {
        const batch = writeBatch(db);
        if (mode === 'replace') {
          // Clear remote docs that the replacement no longer contains.
          const keep = new Set(merged.map(eq => eq.id));
          const remote = await getDocs(collection(db, 'equipment'));
          remote.forEach(docSnap => {
            if (!keep.has(docSnap.id)) batch.delete(doc(db, 'equipment', docSnap.id));
          });
        }
        created.forEach(eq => batch.set(doc(db, 'equipment', eq.id), sanitizeForFirestore(eq)));
        await batch.commit();
      } catch (e) {
        console.warn('Firestore equipment import write error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return created;
  }

  public async deleteEquipment(equipmentId: string): Promise<void> {
    if (!this.isClient()) return;
    this.init();

    const currentList = this.getEquipment().filter(e => e.id !== equipmentId);
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(currentList));

    if (db) {
      try {
        await deleteDoc(doc(db, 'equipment', equipmentId));
      } catch (e) {
        console.warn('Firestore delete equipment error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public async updateEquipmentStatus(equipmentId: string, status: Equipment['status'], activeIssueId?: string | null) {
    if (!this.isClient()) return;
    let targetEq: Equipment | null = null;
    const list = this.getEquipment().map(eq => {
      if (eq.id === equipmentId) {
        targetEq = {
          ...eq,
          status,
          activeIssueId: activeIssueId !== undefined ? activeIssueId : eq.activeIssueId,
          updatedAt: new Date().toISOString()
        };
        return targetEq;
      }

      return eq;
    });
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(list));
    window.dispatchEvent(new Event('sunny_db_update'));

    // Sync to Firestore
    if (targetEq && db) {
      try {
        await setDoc(doc(db, 'equipment', equipmentId), sanitizeForFirestore(targetEq), { merge: true });
      } catch (e) {
        console.warn('Firestore write equipment fallback to local cache:', e);
      }
    }
  }

  // ==========================================
  // MANAGER CONFIGURATION / TASKS
  // ==========================================
  public getEquipmentOptions(): EquipmentOption[] {
    if (!this.isClient()) return INITIAL_EQUIPMENT.map((eq, index) => ({ id: `equipment-option-${index + 1}`, name: eq.name, category: eq.category, createdAt: '', updatedAt: '' }));
    this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.EQUIPMENT_OPTIONS);
    if (raw) return JSON.parse(raw);
    const nowIso = new Date().toISOString();
    const options = Array.from(new Map(this.getEquipment().map(eq => [eq.name, eq])).values()).map((eq, index) => ({ id: `equipment-option-${index + 1}`, name: eq.name, category: eq.category, createdAt: nowIso, updatedAt: nowIso }));
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT_OPTIONS, JSON.stringify(options));
    return options;
  }

  public async saveEquipmentOptions(options: EquipmentOption[]): Promise<void> {
    if (!this.isClient()) return;
    this.init();
    const normalized = options.filter(o => o.name.trim()).map(o => ({ ...o, name: o.name.trim(), updatedAt: new Date().toISOString() }));
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT_OPTIONS, JSON.stringify(normalized));
    if (db) for (const option of normalized) await setDoc(doc(db, 'equipmentOptions', option.id), sanitizeForFirestore(option), { merge: true }).catch(e => console.warn('Firestore equipment option error:', e));
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public getTasks(): FleetTask[] {
    if (!this.isClient()) return [];
    this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    return raw ? JSON.parse(raw) : [];
  }

  public async createTask(data: Omit<FleetTask, 'id' | 'createdAt' | 'status' | 'completedAt' | 'completedInspectionId'> & { status?: FleetTask['status'] }): Promise<FleetTask> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();
    const task: FleetTask = { ...data, id: `task-${Date.now()}`, title: data.title.trim(), description: data.description?.trim() || '', status: data.status || 'open', createdAt: new Date().toISOString(), completedAt: null, completedInspectionId: null };
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([task, ...this.getTasks()]));
    if (db) await setDoc(doc(db, 'tasks', task.id), sanitizeForFirestore(task)).catch(e => console.warn('Firestore create task error:', e));
    window.dispatchEvent(new Event('sunny_db_update'));
    return task;
  }

  public async updateTask(task: FleetTask): Promise<FleetTask> {
    if (!this.isClient()) return task;
    const updated = { ...task, title: task.title.trim(), description: task.description?.trim() || '' };
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.getTasks().map(t => t.id === task.id ? updated : t)));
    if (db) await setDoc(doc(db, 'tasks', task.id), sanitizeForFirestore(updated), { merge: true }).catch(e => console.warn('Firestore update task error:', e));
    window.dispatchEvent(new Event('sunny_db_update'));
    return updated;
  }

  public async deleteTask(taskId: string): Promise<void> {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.getTasks().filter(t => t.id !== taskId)));
    if (db) await deleteDoc(doc(db, 'tasks', taskId)).catch(e => console.warn('Firestore delete task error:', e));
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public getReportSettings(): ReportSettings {
    if (!this.isClient()) return { enabledMetrics: ['pass_rate', 'issues', 'fleet_size'] };
    this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.REPORT_SETTINGS);
    return raw ? JSON.parse(raw) : { enabledMetrics: ['pass_rate', 'issues', 'fleet_size'] };
  }

  public async saveReportSettings(settings: ReportSettings): Promise<void> {
    if (!this.isClient()) return;
    const updated = { ...settings, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.REPORT_SETTINGS, JSON.stringify(updated));
    if (db) await setDoc(doc(db, 'settings', 'reports'), sanitizeForFirestore(updated), { merge: true }).catch(e => console.warn('Firestore report settings error:', e));
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public getAppSettings(): AppSettings {
    if (!this.isClient()) return { recentInspectorsDepth: 3 };
    this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    if (!raw) return { recentInspectorsDepth: 3 };
    try {
      const parsed = JSON.parse(raw) as AppSettings;
      return {
        recentInspectorsDepth: parsed.recentInspectorsDepth === 1 ? 1 : 3,
      };
    } catch {
      return { recentInspectorsDepth: 3 };
    }
  }

  public async saveAppSettings(settings: AppSettings): Promise<void> {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify({
      recentInspectorsDepth: settings.recentInspectorsDepth === 1 ? 1 : 3,
    }));
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  // ==========================================
  // CHECKLIST & CATEGORIES CONFIGURATION
  // ==========================================
  public getChecklistCategories(): ChecklistCategoryConfig[] {
    if (!this.isClient()) return INITIAL_CATEGORIES;
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return data ? JSON.parse(data) : INITIAL_CATEGORIES;
  }

  public getChecklistQuestions(): ChecklistQuestion[] {
    if (!this.isClient()) return INITIAL_CHECKLIST_QUESTIONS;
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    return data ? JSON.parse(data) : INITIAL_CHECKLIST_QUESTIONS;
  }

  public getChecklistConfig(): ChecklistConfig {
    if (!this.isClient()) {
      return {
        id: DEFAULT_CHECKLIST_ID,
        name: 'Standard Detailing Checklist',
        categories: INITIAL_CATEGORIES,
        questions: INITIAL_CHECKLIST_QUESTIONS,
        returnQuestions: DEFAULT_RETURN_QUESTIONS,
        collectOdometer: true,
        collectFuelLevel: true,
      };
    }
    this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.CHECKLIST_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw) as ChecklistConfig;
      const repaired = repairDuplicateCategoryIds(parsed.categories || []);
      const config: ChecklistConfig = {
        ...parsed,
        categories: repaired.categories,
        collectOdometer: parsed.collectOdometer !== false,
        collectFuelLevel: parsed.collectFuelLevel !== false,
        returnQuestions: normalizeReturnQuestions(parsed.returnQuestions),
      };
      if (repaired.changed) {
        // Persist repaired ids without re-entering getChecklistConfig.
        const nowIso = new Date().toISOString();
        const updatedConfig: ChecklistConfig = {
          ...config,
          id: DEFAULT_CHECKLIST_ID,
          updatedAt: nowIso,
        };
        localStorage.setItem(STORAGE_KEYS.CHECKLIST_CONFIG, JSON.stringify(updatedConfig));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updatedConfig.categories));
        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updatedConfig.questions));
        void this.saveChecklistConfig(updatedConfig);
      }
      return config;
    }
    const config: ChecklistConfig = {
      id: DEFAULT_CHECKLIST_ID,
      name: 'Standard Detailing Checklist',
      categories: this.getChecklistCategories(),
      questions: this.getChecklistQuestions(),
      returnQuestions: DEFAULT_RETURN_QUESTIONS,
      updatedAt: new Date().toISOString(),
      collectOdometer: true,
      collectFuelLevel: true,
    };
    return config;
  }

  public async saveChecklistConfig(config: ChecklistConfig): Promise<void> {
    if (!this.isClient()) return;
    this.init();

    const nowIso = new Date().toISOString();
    const updatedConfig: ChecklistConfig = {
      ...config,
      id: DEFAULT_CHECKLIST_ID,
      updatedAt: nowIso
    };

    localStorage.setItem(STORAGE_KEYS.CHECKLIST_CONFIG, JSON.stringify(updatedConfig));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updatedConfig.categories));
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updatedConfig.questions));

    // Save directly to Firestore document: checklists/standard-detailing-checklist
    if (db) {
      try {
        const sanitized = sanitizeForFirestore(updatedConfig);
        await setDoc(doc(db, 'checklists', DEFAULT_CHECKLIST_ID), sanitized);
      } catch (e: any) {
        console.warn('Firestore save checklist error (saved to local storage):', e.message);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public async saveChecklistQuestions(questions: ChecklistQuestion[]): Promise<void> {
    const config = this.getChecklistConfig();
    await this.saveChecklistConfig({
      ...config,
      questions
    });
  }

    public async saveReturnQuestions(questions: ChecklistQuestion[]): Promise<void> {
    const config = this.getChecklistConfig();
    await this.saveChecklistConfig({
      ...config,
      returnQuestions: questions,
    });
  }

public async saveChecklistCategories(categories: ChecklistCategoryConfig[]): Promise<void> {
    const config = this.getChecklistConfig();
    await this.saveChecklistConfig({
      ...config,
      categories
    });
  }

  public async resetChecklistToDefaults(): Promise<void> {
    const defaultConfig: ChecklistConfig = {
      id: DEFAULT_CHECKLIST_ID,
      name: 'Standard Detailing Checklist',
      categories: INITIAL_CATEGORIES,
      questions: INITIAL_CHECKLIST_QUESTIONS,
      updatedAt: new Date().toISOString(),
      collectOdometer: true,
      collectFuelLevel: true,
    };
    await this.saveChecklistConfig(defaultConfig);
  }

  // ==========================================
  // INSPECTIONS (With sanitized write)
  // ==========================================
  public getInspections(): Inspection[] {
    if (!this.isClient()) return [];
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
    return data ? JSON.parse(data) : [];
  }

  public getInspectionsForVehicle(vehicleId: string): Inspection[] {
    return this.getInspections()
      .filter(i => i.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  public getRecentInspectors(
    vehicleId: string,
    depth?: 1 | 3
  ): Array<{
    userName: string;
    submittedAt: string;
    status: InspectionStatus;
    inspectionId: string;
  }> {
    const limit = depth ?? this.getAppSettings().recentInspectorsDepth;
    return this.getInspections()
      .filter(inspection => inspection.vehicleId === vehicleId && inspection.status !== 'in_progress')
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, limit)
      .map(inspection => ({
        userName: inspection.userName,
        submittedAt: inspection.submittedAt,
        status: inspection.status,
        inspectionId: inspection.id
      }));
  }

  public getInspectionsForDate(dateStr: string): Inspection[] {
    return this.getInspections().filter(i => i.dateString === dateStr);
  }

  public submitInspection(data: {
    vehicleId: string;
    userId: string;
    userName: string;
    userEmail: string;
    responses: InspectionResponse[];
    flaggedIssues: Array<{
      equipmentId?: string | null;
      equipmentName: string;
      title: string;
      description: string;
      reportedQuantity?: number | null;
      requiredQuantity?: number | null;
      questionType?: string;
      value?: string;
      priority?: 'critical' | 'moderate' | 'low';
      photoUrl?: string | null;
    }>;
    generalNotes?: string | null;
    taskId?: string | null;
    scheduleLabel?: string | null;
    scheduledAt?: string | null;
    signatureBase64?: string | null;
    photoUrls?: string[] | null;
    odometer?: number | null;
    fuelLevel?: number | null;
  }): { inspection: Inspection; newIssues: Issue[] } {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const vehicle = this.getVehicle(data.vehicleId);
    if (!vehicle) throw new Error('Vehicle not found');

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];
    const inspectionId = `insp-${Date.now()}`;

    const newIssues: Issue[] = [];
    const issueIds: string[] = [];

    // Create Issues for each flagged item
    data.flaggedIssues.forEach((flag, idx) => {
      const issueId = `issue-${Date.now()}-${idx}`;
      issueIds.push(issueId);

      const initialLog: IssueStatusLog = {
        id: `log-${Date.now()}-${idx}`,
        issueId,
        changedById: data.userId || 'anon',
        changedByName: data.userName || 'Inspector',
        oldStatus: 'created',
        newStatus: 'open',
        notes: `Flagged during inspection on ${vehicle.vehicleNumber}: ${flag.description}`,
        timestamp: nowIso
      };

      const newIssue: Issue = {
        id: issueId,
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        equipmentId: flag.equipmentId || null,
        equipmentName: flag.equipmentName || 'Vehicle Equipment',
        reportedById: data.userId || 'anon',
        reportedByName: data.userName || 'Inspector',
        reportedAt: nowIso,
        dateString: dateStr,
        inspectionId,
        title: flag.title || 'Flagged Inspection Item',
        description: flag.description || '',
        type: classifyIssueType({
          title: flag.title,
          description: flag.description,
          questionType: flag.questionType,
          value: flag.value,
        }),
        priority: flag.priority || 'moderate',
        photoUrl: flag.photoUrl || null,
        reportedQuantity: flag.reportedQuantity ?? null,
        requiredQuantity: flag.requiredQuantity ?? null,
        status: 'open',
        resolvedAt: null,
        resolvedById: null,
        resolvedByName: null,
        resolutionNotes: null,
        statusLogs: [initialLog]
      };

      newIssues.push(newIssue);

      // Update equipment status if linked
      if (flag.equipmentId) {
        this.updateEquipmentStatus(flag.equipmentId, 'flagged', issueId);
      }

      // Sync Issue to Firestore (Sanitized)
      if (db) {
        setDoc(doc(db, 'issues', issueId), sanitizeForFirestore(newIssue)).catch((e) =>
          console.warn('Firestore issue write error:', e)
        );
      }
    });

    const status: Inspection['status'] = newIssues.length > 0 ? 'issues_found' : 'passed';

    // Ensure responses are fully sanitized with no undefined values
    const cleanResponses: InspectionResponse[] = (data.responses || []).map(r => ({
      questionId: r.questionId || '',
      questionText: r.questionText || '',
      category: r.category || 'general',
      value: r.value !== undefined ? r.value : 'pass',
      isFlagged: Boolean(r.isFlagged),
      notes: r.notes || null as any,
      equipmentId: r.equipmentId || null as any,
      equipmentName: r.equipmentName || null as any,
      photoUrl: r.photoUrl || null as any,
    }));

    const newInspection: Inspection = {
      id: inspectionId,
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      userId: data.userId || 'anon',
      userName: data.userName || 'Inspector',
      userEmail: data.userEmail || 'inspector@sunnyfleet.com',
      status,
      startedAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
      submittedAt: nowIso,
      dateString: dateStr,
      responses: cleanResponses,
      issueIds,
      generalNotes: data.generalNotes || null as any,
      taskId: data.taskId || null,
      scheduleLabel: data.scheduleLabel || null,
      scheduledAt: data.scheduledAt || null,
      signatureBase64: data.signatureBase64 || null as any,
      photoUrls: data.photoUrls || null as any,
      odometer: data.odometer !== undefined && data.odometer !== null ? Number(data.odometer) : null as any,
      fuelLevel: data.fuelLevel !== undefined && data.fuelLevel !== null ? Number(data.fuelLevel) : null as any,
    };

    // Save Inspection locally
    const allInspections = [newInspection, ...this.getInspections()];
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(allInspections));

    // Save Issues locally
    if (newIssues.length > 0) {
      const allIssues = [...newIssues, ...this.getIssues()];
      localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(allIssues));
    }

    // Update Vehicle state (checkout only if the van is free — never steal another driver)
    const occupied = occupancyAfterInspection(vehicle, { id: data.userId, name: data.userName }, now);
    const updatedVehicle: Vehicle = {
      ...occupied,
      lastInspectionId: inspectionId,
      lastInspectionStatus: status,
      lastInspectionAt: nowIso,
      odometer: data.odometer !== undefined && data.odometer !== null ? Number(data.odometer) : vehicle.odometer,
      fuelLevel: data.fuelLevel !== undefined && data.fuelLevel !== null ? Number(data.fuelLevel) : vehicle.fuelLevel,
    };
    this.updateVehicle(updatedVehicle);

    if (data.taskId) {
      const task = this.getTasks().find(t => t.id === data.taskId);
      if (task && task.status !== 'completed') {
        this.updateTask({ ...task, status: 'completed', completedAt: nowIso, completedInspectionId: inspectionId });
      }
    }

    // Sync Inspection to Firestore (Sanitized!)
    if (db) {
      setDoc(doc(db, 'inspections', inspectionId), sanitizeForFirestore(newInspection)).catch((e) =>
        console.warn('Firestore inspection write error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return { inspection: newInspection, newIssues };
  }

  // Offline Inspections Support
  public getOfflineInspections(): Inspection[] {
    if (!this.isClient()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_INSPECTIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveOfflineInspection(inspection: Inspection): void {
    if (!this.isClient()) return;
    const existing = this.getOfflineInspections();
    const updated = [inspection, ...existing.filter(i => i.id !== inspection.id)];
    localStorage.setItem(STORAGE_KEYS.OFFLINE_INSPECTIONS, JSON.stringify(updated));
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public removeOfflineInspection(inspectionId: string): void {
    if (!this.isClient()) return;
    const existing = this.getOfflineInspections();
    const updated = existing.filter(i => i.id !== inspectionId);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_INSPECTIONS, JSON.stringify(updated));
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public async syncOfflineInspections(): Promise<number> {
    if (!this.isClient()) return 0;
    const offline = this.getOfflineInspections();
    if (offline.length === 0) return 0;

    let syncedCount = 0;
    for (const item of offline) {
      try {
        if (db) {
          await setDoc(doc(db, 'inspections', item.id), sanitizeForFirestore(item), { merge: true });
        }
        syncedCount++;
      } catch (e) {
        console.warn('Sync offline inspection failed:', e);
      }
    }
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_INSPECTIONS);
    window.dispatchEvent(new Event('sunny_db_update'));
    return syncedCount;
  }

  /**
   * Reject an inspection and provide feedback for corrections.
   * Sets status to 'rejected' and stores manager feedback and flagged questions.
   */
  public async rejectInspection(
    inspectionId: string,
    rejectedBy: string,
    reason: string,
    flaggedQuestionIds: string[]
  ): Promise<Inspection> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const inspections = this.getInspections();
    const inspection = inspections.find(i => i.id === inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    const nowIso = new Date().toISOString();
    const updatedInspection: Inspection = {
      ...inspection,
      status: 'rejected',
      rejectionReason: reason,
      rejectedBy,
      rejectedAt: nowIso,
      flaggedForCorrection: flaggedQuestionIds
    };

    const updated = inspections.map(i => (i.id === inspectionId ? updatedInspection : i));
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(updated));

    // Sync to Firestore
    if (db) {
      await setDoc(
        doc(db, 'inspections', inspectionId),
        sanitizeForFirestore(updatedInspection),
        { merge: true }
      ).catch((e) => console.warn('Firestore rejection sync error:', e));
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return updatedInspection;
  }

  /**
   * Resubmit a rejected inspection with corrections.
   * Creates a new inspection linked to the original, preserving the correction history.
   */
  public async resubmitInspection(
    originalInspectionId: string,
    updatedResponses: InspectionResponse[],
    updatedNotes?: string
  ): Promise<{ inspection: Inspection; newIssues: Issue[] }> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const original = this.getInspections().find(i => i.id === originalInspectionId);
    if (!original) throw new Error('Original inspection not found');

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];
    const newInspectionId = `insp-${Date.now()}-resubmit`;

    // Identify flagged items in updated responses
    const newIssues: Issue[] = [];
    const issueIds: string[] = [];

    updatedResponses.forEach((response, idx) => {
      if (response.isFlagged) {
        const issueId = `issue-${Date.now()}-${idx}`;
        issueIds.push(issueId);

        const initialLog: IssueStatusLog = {
          id: `log-${Date.now()}-${idx}`,
          issueId,
          changedById: original.userId || 'anon',
          changedByName: original.userName || 'Inspector',
          oldStatus: 'created',
          newStatus: 'open',
          notes: `Flagged in resubmission of inspection ${original.id}`,
          timestamp: nowIso
        };

        const newIssue: Issue = {
          id: issueId,
          vehicleId: original.vehicleId,
          vehicleNumber: original.vehicleNumber,
          equipmentId: response.equipmentId || null,
          equipmentName: response.equipmentName || 'Vehicle Equipment',
          reportedById: original.userId || 'anon',
          reportedByName: original.userName || 'Inspector',
          reportedAt: nowIso,
          dateString: dateStr,
          inspectionId: newInspectionId,
          title: response.questionText,
          description: response.notes || '',
          type: 'needs_repair',
          status: 'open',
          resolvedAt: null,
          resolvedById: null,
          resolvedByName: null,
          resolutionNotes: null,
          statusLogs: [initialLog]
        };

        newIssues.push(newIssue);

        if (db) {
          setDoc(doc(db, 'issues', issueId), sanitizeForFirestore(newIssue)).catch((e) =>
            console.warn('Firestore issue write error:', e)
          );
        }
      }
    });

    const status: Inspection['status'] = newIssues.length > 0 ? 'issues_found' : 'passed';

    const cleanResponses: InspectionResponse[] = updatedResponses.map(r => ({
      questionId: r.questionId || '',
      questionText: r.questionText || '',
      category: r.category || 'general',
      value: r.value !== undefined ? r.value : 'pass',
      isFlagged: Boolean(r.isFlagged),
      notes: r.notes || null as any,
      equipmentId: r.equipmentId || null as any,
      equipmentName: r.equipmentName || null as any
    }));

    const resubmittedInspection: Inspection = {
      id: newInspectionId,
      vehicleId: original.vehicleId,
      vehicleNumber: original.vehicleNumber,
      userId: original.userId,
      userName: original.userName,
      userEmail: original.userEmail,
      status,
      startedAt: original.startedAt,
      submittedAt: nowIso,
      dateString: dateStr,
      responses: cleanResponses,
      issueIds,
      generalNotes: updatedNotes || original.generalNotes || null as any,
      taskId: original.taskId || null,
      scheduleLabel: original.scheduleLabel || null,
      scheduledAt: original.scheduledAt || null,
      previousSubmissionId: originalInspectionId
    };

    // Save new inspection locally
    const allInspections = [resubmittedInspection, ...this.getInspections()];
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(allInspections));

    // Save new issues locally
    if (newIssues.length > 0) {
      const allIssues = [...newIssues, ...this.getIssues()];
      localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(allIssues));
    }

    // Sync to Firestore
    if (db) {
      setDoc(doc(db, 'inspections', newInspectionId), sanitizeForFirestore(resubmittedInspection)).catch((e) =>
        console.warn('Firestore inspection write error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return { inspection: resubmittedInspection, newIssues };
  }

  public async deleteInspection(inspectionId: string): Promise<void> {
    if (!this.isClient()) return;
    this.init();

    const inspections = this.getInspections();
    const target = inspections.find(i => i.id === inspectionId);
    const updated = inspections.filter(i => i.id !== inspectionId);
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(updated));

    // If the vehicle's lastInspectionId was this inspection, update the vehicle record
    if (target) {
      const vehicle = this.getVehicle(target.vehicleId);
      if (vehicle && vehicle.lastInspectionId === inspectionId) {
        const remainingForVehicle = updated.filter(i => i.vehicleId === target.vehicleId);
        const latest = remainingForVehicle.length > 0 ? remainingForVehicle[0] : null;
        this.updateVehicle({
          ...vehicle,
          lastInspectionId: latest ? latest.id : null,
          lastInspectionStatus: latest ? latest.status : null,
          lastInspectionAt: latest ? latest.submittedAt : null
        });
      }
    }

    if (db) {
      try {
        await deleteDoc(doc(db, 'inspections', inspectionId));
      } catch (e) {
        console.warn('Firestore delete inspection error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }

  private persistInspection(updated: Inspection): void {
    const list = this.getInspections().map(i => (i.id === updated.id ? updated : i));
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(list));
    if (db) {
      setDoc(doc(db, 'inspections', updated.id), sanitizeForFirestore(updated), { merge: true }).catch((e) =>
        console.warn('Firestore inspection write error:', e)
      );
    }
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  public getPendingInspectionDeletes(): Inspection[] {
    return this.getInspections()
      .filter(i => Boolean(i.deleteRequestedAt))
      .sort((a, b) => new Date(b.deleteRequestedAt || 0).getTime() - new Date(a.deleteRequestedAt || 0).getTime());
  }

  public async requestInspectionDelete(
    inspectionId: string,
    requester: { id: string; name: string },
    note: string
  ): Promise<void> {
    if (!this.isClient()) return;
    const noteTrim = note.trim();
    if (!noteTrim) throw new Error('Add a short note so the manager knows why.');
    const insp = this.getInspections().find(i => i.id === inspectionId);
    if (!insp) throw new Error('Inspection not found.');
    if (insp.userId !== requester.id) throw new Error('You can only request deletion of your own inspections.');
    this.persistInspection({
      ...insp,
      deleteRequestedAt: new Date().toISOString(),
      deleteRequestedById: requester.id,
      deleteRequestedByName: requester.name,
      deleteRequestNote: noteTrim,
    });
  }

  public async denyInspectionDelete(inspectionId: string): Promise<void> {
    if (!this.isClient()) return;
    const insp = this.getInspections().find(i => i.id === inspectionId);
    if (!insp) throw new Error('Inspection not found.');
    this.persistInspection({
      ...insp,
      deleteRequestedAt: null,
      deleteRequestedById: null,
      deleteRequestedByName: null,
      deleteRequestNote: null,
    });
  }

  public async approveInspectionDelete(inspectionId: string): Promise<void> {
    await this.deleteInspection(inspectionId);
  }

  public submitReturnInspection(data: {
    vehicleId: string;
    userId: string;
    userName: string;
    userEmail: string;
    responses: InspectionResponse[];
    generalNotes?: string | null;
    photoUrls?: string[] | null;
    missedReturnId?: string | null;
  }): { inspection: Inspection } {
    if (!this.isClient()) throw new Error('Client only');
    this.init();
    const vehicle = this.getVehicle(data.vehicleId);
    if (!vehicle) throw new Error('Vehicle not found');

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = localDateString(now);
    const inspectionId = `return-${Date.now()}`;

    const cleanResponses: InspectionResponse[] = (data.responses || []).map(r => ({
      questionId: r.questionId || '',
      questionText: r.questionText || '',
      category: r.category || 'general',
      value: r.value !== undefined ? r.value : '',
      isFlagged: Boolean(r.isFlagged),
      notes: r.notes || (null as any),
      equipmentId: r.equipmentId || (null as any),
      equipmentName: r.equipmentName || (null as any),
      photoUrl: r.photoUrl || (null as any),
    }));

    const newInspection: Inspection = {
      id: inspectionId,
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      userId: data.userId || 'anon',
      userName: data.userName || 'Driver',
      userEmail: data.userEmail || '',
      status: 'passed',
      kind: 'return',
      startedAt: nowIso,
      submittedAt: nowIso,
      dateString: dateStr,
      responses: cleanResponses,
      issueIds: [],
      generalNotes: data.generalNotes || (null as any),
      photoUrls: data.photoUrls || (null as any),
    };

    const allInspections = [newInspection, ...this.getInspections()];
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(allInspections));

    const cleared = checkInFields(vehicle);
    this.updateVehicle(cleared);

    if (data.missedReturnId) {
      void this.completeMissedReturn(data.missedReturnId, inspectionId);
    }

    if (db) {
      setDoc(doc(db, 'inspections', inspectionId), sanitizeForFirestore(newInspection)).catch((e) =>
        console.warn('Firestore return inspection write error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return { inspection: newInspection };
  }

  // ==========================================
  // ISSUES & STATUS LOGS
  // ==========================================
  public getIssues(): Issue[] {
    if (!this.isClient()) return [];
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.ISSUES);
    return data ? JSON.parse(data) : [];
  }

  public getIssue(id: string): Issue | undefined {
    return this.getIssues().find(i => i.id === id);
  }

  public getIssuesForVehicle(vehicleId: string): Issue[] {
    return this.getIssues()
      .filter(i => i.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  public getIssuesForDate(dateStr: string): Issue[] {
    return this.getIssues().filter(i => i.dateString === dateStr);
  }

  public getOpenIssues(): Issue[] {
    return this.getIssues()
      .filter(i => i.status !== 'fixed')
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  public async resolveStockIssue(
    issueId: string,
    action: 'update_stock' | 'remove_from_van',
    changedBy: { id: string; name: string },
    opts?: { quantity?: number }
  ): Promise<Issue> {
    const issue = this.getIssue(issueId);
    if (!issue) throw new Error('Issue not found');
    if (!issue.equipmentId) throw new Error('Issue has no linked equipment.');
    if (!issue.vehicleId) throw new Error('Issue has no linked vehicle.');

    if (action === 'update_stock') {
      const qty = opts?.quantity ?? issue.reportedQuantity;
      if (qty === undefined || qty === null || !Number.isInteger(Number(qty)) || Number(qty) < 0) {
        throw new Error('Provide the actual quantity to set on the vehicle.');
      }
      await this.setVehicleAssignmentQuantity(issue.equipmentId, issue.vehicleId, Number(qty));
      return this.updateIssueStatus(
        issueId,
        'fixed',
        changedBy,
        `Update Stock: set van quantity to ${qty}`
      );
    }

    const equipment = this.getEquipmentItem(issue.equipmentId);
    const held =
      equipment?.assignments?.find(a => a.vehicleId === issue.vehicleId)?.quantity ?? 0;
    const amount = opts?.quantity ?? held;
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Nothing to remove from van.');
    }
    await this.returnEquipmentToShop(issue.equipmentId, issue.vehicleId, amount);
    return this.updateIssueStatus(
      issueId,
      'fixed',
      changedBy,
      `Remove from Van: returned ${amount} to shop`
    );
  }

  // Append-only Status Transition
  public updateIssueStatus(
    issueId: string, 
    newStatus: IssueStatus, 
    changedBy: { id: string; name: string }, 
    notes: string
  ): Issue {
    if (!this.isClient()) throw new Error('Client only');
    const issues = this.getIssues();
    const targetIndex = issues.findIndex(i => i.id === issueId);
    if (targetIndex === -1) throw new Error('Issue not found');

    const issue = issues[targetIndex];
    const nowIso = new Date().toISOString();

    const newLog: IssueStatusLog = {
      id: `log-${Date.now()}`,
      issueId,
      changedById: changedBy.id,
      changedByName: changedBy.name,
      oldStatus: issue.status,
      newStatus,
      notes: notes.trim(),
      timestamp: nowIso
    };

    const updatedIssue: Issue = {
      ...issue,
      status: newStatus,
      statusLogs: [...(issue.statusLogs || []), newLog],
      resolvedAt: newStatus === 'fixed' ? nowIso : issue.resolvedAt || null,
      resolvedById: newStatus === 'fixed' ? changedBy.id : issue.resolvedById || null,
      resolvedByName: newStatus === 'fixed' ? changedBy.name : issue.resolvedByName || null,
      resolutionNotes: newStatus === 'fixed' ? notes : issue.resolutionNotes || null
    };

    issues[targetIndex] = updatedIssue;
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

    // Update corresponding equipment status if linked
    if (issue.equipmentId) {
      let equipmentStatus: Equipment['status'] = 'working';
      if (newStatus === 'open') equipmentStatus = 'flagged';
      else if (newStatus === 'needs_repair') equipmentStatus = 'needs_repair';
      else if (newStatus === 'being_repaired') equipmentStatus = 'being_repaired';
      else if (newStatus === 'fixed') equipmentStatus = 'working';

      this.updateEquipmentStatus(issue.equipmentId, equipmentStatus, newStatus === 'fixed' ? null : issue.id);
    }

    // Sync to Firestore (Sanitized)
    if (db) {
      setDoc(doc(db, 'issues', issueId), sanitizeForFirestore(updatedIssue), { merge: true }).catch((e) =>
        console.warn('Firestore update issue status error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return updatedIssue;
  }

  public updateIssueType(
    issueId: string,
    type: IssueType,
    changedBy: { id: string; name: string }
  ): Issue {
    if (!this.isClient()) throw new Error('Client only');
    const issues = this.getIssues();
    const targetIndex = issues.findIndex(i => i.id === issueId);
    if (targetIndex === -1) throw new Error('Issue not found');

    const issue = issues[targetIndex];
    const oldType = issue.type || 'needs_repair';
    const newLog: IssueStatusLog = {
      id: `log-${Date.now()}`,
      issueId,
      changedById: changedBy.id,
      changedByName: changedBy.name,
      oldStatus: issue.status,
      newStatus: issue.status,
      notes: `Issue type changed from ${oldType} to ${type}`,
      timestamp: new Date().toISOString()
    };
    const updatedIssue: Issue = {
      ...issue,
      type,
      statusLogs: [...(issue.statusLogs || []), newLog]
    };

    issues[targetIndex] = updatedIssue;
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

    if (db) {
      setDoc(doc(db, 'issues', issueId), sanitizeForFirestore(updatedIssue), { merge: true }).catch((e) =>
        console.warn('Firestore update issue type error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return updatedIssue;
  }

  public updateIssueDetails(
    issueId: string,
    updates: {
      priority?: 'critical' | 'moderate' | 'low';
      assignedTechnician?: string | null;
      estimatedCompletionDate?: string | null;
      repairCost?: number | null;
      partNumber?: string | null;
    },
    changedBy?: { id: string; name: string }
  ): Issue {
    if (!this.isClient()) throw new Error('Client only');
    const issues = this.getIssues();
    const targetIndex = issues.findIndex(i => i.id === issueId);
    if (targetIndex === -1) throw new Error('Issue not found');

    const issue = issues[targetIndex];
    const nowIso = new Date().toISOString();
    const detailNotes: string[] = [];
    if (updates.priority && updates.priority !== issue.priority) {
      detailNotes.push(`priority → ${updates.priority}`);
    }
    if (updates.assignedTechnician !== undefined && updates.assignedTechnician !== issue.assignedTechnician) {
      detailNotes.push(`technician → ${updates.assignedTechnician || 'unassigned'}`);
    }
    if (updates.repairCost !== undefined && updates.repairCost !== issue.repairCost) {
      detailNotes.push(`repair cost → ${updates.repairCost ?? 'n/a'}`);
    }
    if (updates.partNumber !== undefined && updates.partNumber !== issue.partNumber) {
      detailNotes.push(`part # → ${updates.partNumber || 'n/a'}`);
    }

    const statusLogs = [...(issue.statusLogs || [])];
    if (changedBy && detailNotes.length > 0) {
      statusLogs.push({
        id: `log-${Date.now()}`,
        issueId,
        changedById: changedBy.id,
        changedByName: changedBy.name,
        oldStatus: issue.status,
        newStatus: issue.status,
        notes: `Details updated: ${detailNotes.join(', ')}`,
        timestamp: nowIso
      });
    }

    const updatedIssue: Issue = {
      ...issue,
      ...updates,
      statusLogs
    };

    issues[targetIndex] = updatedIssue;
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

    if (db) {
      setDoc(doc(db, 'issues', issueId), sanitizeForFirestore(updatedIssue), { merge: true }).catch((e) =>
        console.warn('Firestore update issue details error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return updatedIssue;
  }

  public batchResolveIssues(
    issueIds: string[],
    notes: string,
    changedBy: { id: string; name: string },
    repairCost?: number,
    partNumber?: string
  ): Issue[] {
    const results: Issue[] = [];
    for (const id of issueIds) {
      try {
        if (repairCost !== undefined || partNumber !== undefined) {
          this.updateIssueDetails(id, {
            repairCost: repairCost !== undefined ? repairCost : undefined,
            partNumber: partNumber !== undefined ? partNumber : undefined
          });
        }
        const res = this.updateIssueStatus(id, 'fixed', changedBy, notes);
        results.push(res);
      } catch (e) {
        console.warn('Batch resolve issue failed for', id, e);
      }
    }
    return results;
  }

  public async deleteIssue(issueId: string): Promise<void> {
    if (!this.isClient()) return;
    const issue = this.getIssue(issueId);
    const issues = this.getIssues().filter(i => i.id !== issueId);
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

    // Clean up issueId from any inspection's issueIds
    const currentInspections = this.getInspections();
    let inspectionsChanged = false;
    const updatedInspections = currentInspections.map(insp => {
      if (insp.issueIds && insp.issueIds.includes(issueId)) {
        inspectionsChanged = true;
        return { ...insp, issueIds: insp.issueIds.filter(id => id !== issueId) };
      }
      return insp;
    });
    if (inspectionsChanged) {
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(updatedInspections));
    }

    if (issue?.equipmentId) {
      const equipment = this.getEquipmentItem(issue.equipmentId);
      if (equipment?.activeIssueId === issueId) {
        await this.updateEquipmentStatus(issue.equipmentId, 'working', null);
      }
    }

    if (db) {
      try {
        await deleteDoc(doc(db, 'issues', issueId));
      } catch (e) {
        console.warn('Firestore delete issue error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }
  private readVehicleDamageEvents(): VehicleDamageEvent[] {
    if (!this.isClient()) return [];
    const data = localStorage.getItem(STORAGE_KEYS.VEHICLE_DAMAGE);
    return data ? (JSON.parse(data) as VehicleDamageEvent[]) : [];
  }

  public getVehicleDamageEvents(vehicleId?: string): VehicleDamageEvent[] {
    if (!this.isClient()) return [];
    this.init();
    const all = this.readVehicleDamageEvents();
    const filtered = vehicleId ? all.filter((e) => e.vehicleId === vehicleId) : all;
    return filtered.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async addVehicleDamageEvent(input: {
    vehicleId: string;
    side: VehicleSide | null;
    noNewDamage: boolean;
    note?: string;
    photoDataUrls: string[];
    region?: DamageRegion | null;
    inspectionId?: string | null;
    userId: string;
    userName: string;
  }): Promise<VehicleDamageEvent> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const vehicle = this.getVehicle(input.vehicleId);
    if (!vehicle) throw new Error('Vehicle not found');

    const photoDataUrls = (input.photoDataUrls || []).slice(0, 8);
    const region =
      input.noNewDamage || !input.region ? null : normalizeRegion(input.region);

    assertDamagePayload({
      noNewDamage: input.noNewDamage,
      side: input.noNewDamage ? null : input.side,
      photoDataUrls: input.noNewDamage ? [] : photoDataUrls,
      region,
    });

    const event: VehicleDamageEvent = {
      id: `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      vehicleId: input.vehicleId,
      side: input.noNewDamage ? null : input.side,
      noNewDamage: Boolean(input.noNewDamage),
      note: input.note?.trim() || undefined,
      photoDataUrls: input.noNewDamage ? [] : photoDataUrls,
      region: input.noNewDamage || !region ? undefined : region,
      inspectionId: input.inspectionId ?? null,
      userId: input.userId,
      userName: input.userName,
      createdAt: new Date().toISOString(),
    };

    const next = [event, ...this.readVehicleDamageEvents()];
    localStorage.setItem(STORAGE_KEYS.VEHICLE_DAMAGE, JSON.stringify(next));

    if (db) {
      try {
        await setDoc(doc(db, 'vehicleDamage', event.id), sanitizeForFirestore(event));
      } catch (e: any) {
        console.warn('Firestore vehicleDamage write error (saved locally):', e?.message || e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return event;
  }


}

export const dbService = new DataStore();
