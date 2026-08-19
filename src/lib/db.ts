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
  User,
  UserRole,
  EquipmentCategory
} from '@/types';
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
};

const DEFAULT_CHECKLIST_ID = 'standard-detailing-checklist';

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

  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  public init() {
    if (!this.isClient() || this.initialized) return;

    if (!localStorage.getItem(STORAGE_KEYS.SEEDED)) {
      this.resetToDefaults();
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
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
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

  // Clean Slate default reset: 1 demo vehicle, 1 demo equipment, 1 demo employee, 1 demo manager
  public resetToDefaults() {
    if (!this.isClient()) return;
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
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.CHECKLIST_CONFIG, JSON.stringify(initialConfig));

    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(INITIAL_INSPECTIONS));
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(INITIAL_ISSUES));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');

    // Also sync to Firestore if connected
    if (db) {
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

  public async createUser(userData: {
    name: string;
    email: string;
    role: UserRole;
    status?: 'active' | 'inactive';
    avatarUrl?: string;
  }): Promise<User> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const timestamp = Date.now();
    const newUser: User = {
      id: `user-${timestamp}`,
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      role: userData.role,
      status: userData.status || 'active',
      avatarUrl: userData.avatarUrl?.trim() || `https://images.unsplash.com/photo-${1534528741775 + (timestamp % 1000)}?w=150&auto=format&fit=crop&q=80`
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

    const currentUsers = this.getUsers();
    const updatedUsers = currentUsers.map(u => u.id === updated.id ? { ...u, ...updated } : u);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

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

    // Clear user from any currently assigned vehicle
    const vehicles = this.getVehicles();
    vehicles.forEach(v => {
      if (v.currentUserId === userId) {
        this.updateVehicle({
          ...v,
          currentUserId: null,
          currentUserName: null,
          currentUserStartTime: null
        });
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
  public getVehicles(): Vehicle[] {
    if (!this.isClient()) return [];
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    return data ? JSON.parse(data) : [];
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
      lastInspectionId: vehicleData.lastInspectionId || null,
      lastInspectionStatus: vehicleData.lastInspectionStatus || null,
      lastInspectionAt: vehicleData.lastInspectionAt || null,
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
      if (eq.vehicleId === updated.id && eq.vehicleNumber !== updated.vehicleNumber) {
        return { ...eq, vehicleNumber: updated.vehicleNumber };
      }
      return eq;
    });
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));

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

  public async deleteVehicle(vehicleId: string): Promise<void> {
    if (!this.isClient()) return;

    // Filter out vehicle
    const vehicles = this.getVehicles().filter(v => v.id !== vehicleId);
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));

    // Cleanup associated equipment
    const equipment = this.getEquipment().filter(e => e.vehicleId !== vehicleId);
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));

    // Cleanup associated inspections
    const inspections = this.getInspections().filter(i => i.vehicleId !== vehicleId);
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(inspections));

    // Cleanup associated issues
    const issues = this.getIssues().filter(i => i.vehicleId !== vehicleId);
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

    // Sync to Firestore
    if (db) {
      try {
        await deleteDoc(doc(db, 'vehicles', vehicleId));
      } catch (e) {
        console.warn('Firestore delete vehicle fallback to local cache:', e);
      }
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
    return data ? JSON.parse(data) : [];
  }

  public getEquipmentItem(id: string): Equipment | undefined {
    return this.getEquipment().find(e => e.id === id);
  }

  public getEquipmentForVehicle(vehicleId: string): Equipment[] {
    return this.getEquipment().filter(e => e.vehicleId === vehicleId);
  }

  public async createEquipment(equipmentData: {
    name: string;
    vehicleId: string;
    category?: EquipmentCategory;
    status?: Equipment['status'];
  }): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const timestamp = Date.now();
    const targetVehicle = this.getVehicle(equipmentData.vehicleId);
    const nowIso = new Date().toISOString();

    const newEq: Equipment = {
      id: `eq-${timestamp}`,
      vehicleId: equipmentData.vehicleId,
      vehicleNumber: targetVehicle ? targetVehicle.vehicleNumber : 'Unassigned',
      name: equipmentData.name.trim(),
      category: equipmentData.category || 'equipment',
      status: equipmentData.status || 'working',
      activeIssueId: null,
      createdAt: nowIso,
      updatedAt: nowIso
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

  public async updateEquipment(updated: Equipment): Promise<Equipment> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const targetVehicle = this.getVehicle(updated.vehicleId);
    const enriched: Equipment = {
      ...updated,
      vehicleNumber: targetVehicle ? targetVehicle.vehicleNumber : updated.vehicleNumber || 'Unassigned',
      updatedAt: new Date().toISOString()
    };

    const sanitized = sanitizeForFirestore(enriched);
    const currentList = this.getEquipment();
    const updatedList = currentList.map(e => e.id === updated.id ? sanitized : e);
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(updatedList));

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
      };
    }
    this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.CHECKLIST_CONFIG);
    if (raw) {
      return JSON.parse(raw);
    }
    const config: ChecklistConfig = {
      id: DEFAULT_CHECKLIST_ID,
      name: 'Standard Detailing Checklist',
      categories: this.getChecklistCategories(),
      questions: this.getChecklistQuestions(),
      updatedAt: new Date().toISOString()
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
      updatedAt: new Date().toISOString()
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
    return this.getInspections().filter(i => i.vehicleId === vehicleId);
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
    }>;
    generalNotes?: string | null;
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
      equipmentName: r.equipmentName || null as any
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
      generalNotes: data.generalNotes || null as any
    };

    // Save Inspection locally
    const allInspections = [newInspection, ...this.getInspections()];
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(allInspections));

    // Save Issues locally
    if (newIssues.length > 0) {
      const allIssues = [...newIssues, ...this.getIssues()];
      localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(allIssues));
    }

    // Update Vehicle state
    const updatedVehicle: Vehicle = {
      ...vehicle,
      status: 'in_use',
      currentUserId: data.userId || null,
      currentUserName: data.userName || null,
      currentUserStartTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      lastInspectionId: inspectionId,
      lastInspectionStatus: status,
      lastInspectionAt: nowIso
    };
    this.updateVehicle(updatedVehicle);

    // Sync Inspection to Firestore (Sanitized!)
    if (db) {
      setDoc(doc(db, 'inspections', inspectionId), sanitizeForFirestore(newInspection)).catch((e) =>
        console.warn('Firestore inspection write error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return { inspection: newInspection, newIssues };
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
    return this.getIssues().filter(i => i.vehicleId === vehicleId);
  }

  public getIssuesForDate(dateStr: string): Issue[] {
    return this.getIssues().filter(i => i.dateString === dateStr);
  }

  public getOpenIssues(): Issue[] {
    return this.getIssues().filter(i => i.status !== 'fixed');
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

  public async deleteIssue(issueId: string): Promise<void> {
    if (!this.isClient()) return;
    const issues = this.getIssues().filter(i => i.id !== issueId);
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));

    if (db) {
      try {
        await deleteDoc(doc(db, 'issues', issueId));
      } catch (e) {
        console.warn('Firestore delete issue error:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
  }
}

export const dbService = new DataStore();
