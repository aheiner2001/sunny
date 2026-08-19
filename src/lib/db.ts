'use client';

import { 
  Vehicle, 
  Equipment, 
  ChecklistQuestion, 
  Inspection, 
  Issue, 
  IssueStatusLog,
  InspectionResponse,
  IssueStatus
} from '@/types';
import { 
  INITIAL_VEHICLES, 
  INITIAL_EQUIPMENT, 
  INITIAL_CHECKLIST_QUESTIONS, 
  INITIAL_INSPECTIONS, 
  INITIAL_ISSUES, 
  INITIAL_USERS 
} from './mockData';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs, 
  updateDoc, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

const STORAGE_KEYS = {
  VEHICLES: 'sunny_vehicles',
  EQUIPMENT: 'sunny_equipment',
  QUESTIONS: 'sunny_questions',
  INSPECTIONS: 'sunny_inspections',
  ISSUES: 'sunny_issues',
  SEEDED: 'sunny_seeded_v1',
  FIREBASE_SYNCED: 'sunny_firebase_synced',
};

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
  public setupFirestoreListeners() {
    if (!this.isClient() || this.listening || !db) return;
    this.listening = true;

    try {
      // Listen to Vehicles collection
      onSnapshot(collection(db, 'vehicles'), (snapshot) => {
        if (!snapshot.empty || localStorage.getItem(STORAGE_KEYS.FIREBASE_SYNCED) === 'true') {
          const list: Vehicle[] = [];
          snapshot.forEach((doc) => list.push(doc.data() as Vehicle));
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
          snapshot.forEach((doc) => list.push(doc.data() as Issue));
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
          snapshot.forEach((doc) => list.push(doc.data() as Inspection));
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
          snapshot.forEach((doc) => list.push(doc.data() as Equipment));
          localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(list));
          window.dispatchEvent(new Event('sunny_db_update'));
        }
      }, (err) => {
        console.warn('Firestore equipment listener (using local cache):', err.message);
      });

    } catch (e: any) {
      console.warn('Could not attach Firestore listeners:', e.message);
    }
  }

  // Push all fleet data directly to Cloud Firestore
  public async syncAllToFirestore(): Promise<{ success: boolean; message: string }> {
    if (!db) return { success: false, message: 'Firestore is not initialized.' };

    try {
      const batch = writeBatch(db);

      // Seed Vehicles
      this.getVehicles().forEach((v) => {
        const ref = doc(db, 'vehicles', v.id);
        batch.set(ref, v);
      });

      // Seed Equipment
      this.getEquipment().forEach((eq) => {
        const ref = doc(db, 'equipment', eq.id);
        batch.set(ref, eq);
      });

      // Seed Inspections
      this.getInspections().forEach((insp) => {
        const ref = doc(db, 'inspections', insp.id);
        batch.set(ref, insp);
      });

      // Seed Issues
      this.getIssues().forEach((iss) => {
        const ref = doc(db, 'issues', iss.id);
        batch.set(ref, iss);
      });

      // Seed Checklist Questions
      this.getChecklistQuestions().forEach((q) => {
        const ref = doc(db, 'checklist_questions', q.id);
        batch.set(ref, q);
      });

      // Seed Users
      INITIAL_USERS.forEach((u) => {
        const ref = doc(db, 'users', u.id);
        batch.set(ref, u);
      });

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

  // Clean Slate default reset: empty collections, default checklist questions initialized
  public resetToDefaults() {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_CHECKLIST_QUESTIONS));
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
    window.dispatchEvent(new Event('sunny_db_update'));
  }

  // Populates full mock demo dataset for testing & demonstrations
  public async loadStarterDemoData(): Promise<void> {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(INITIAL_EQUIPMENT));
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_CHECKLIST_QUESTIONS));
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(INITIAL_INSPECTIONS));
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(INITIAL_ISSUES));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');

    if (db) {
      try {
        await this.syncAllToFirestore();
      } catch (e) {
        console.warn('Could not sync starter demo data to Firestore:', e);
      }
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

  // Vehicles
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
      .replace(/^https?:\/\/[^/]+\/inspect\//i, '')
      .replace(/^\/inspect\//i, '')
      .replace(/^sunny:\/\/vehicle\//i, '');

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

  public async createVehicle(
    vehicleData: Partial<Vehicle> & { vehicleNumber: string; name: string; licensePlate: string },
    initialEquipmentNames?: string[]
  ): Promise<Vehicle> {
    if (!this.isClient()) throw new Error('Client only');
    this.init();

    const timestamp = Date.now();
    const vehicleId = vehicleData.id || `van-${timestamp}`;
    const qrCodeToken = vehicleData.qrCodeToken || `token-${timestamp}`;
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
        await setDoc(doc(db, 'vehicles', newVehicle.id), newVehicle);
        for (const eq of newEquipmentList) {
          await setDoc(doc(db, 'equipment', eq.id), eq);
        }
      } catch (e) {
        console.warn('Firestore create vehicle write fallback to local cache:', e);
      }
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return newVehicle;
  }

  public async updateVehicle(updated: Vehicle) {
    if (!this.isClient()) return;
    const vehicles = this.getVehicles().map(v => v.id === updated.id ? updated : v);
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    window.dispatchEvent(new Event('sunny_db_update'));

    // Sync to Firestore
    try {
      if (db) {
        await setDoc(doc(db, 'vehicles', updated.id), updated, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore write vehicle fallback to local cache:', e);
    }
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

  // Equipment
  public getEquipment(): Equipment[] {
    if (!this.isClient()) return [];
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
    return data ? JSON.parse(data) : [];
  }

  public getEquipmentForVehicle(vehicleId: string): Equipment[] {
    return this.getEquipment().filter(e => e.vehicleId === vehicleId);
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
        await setDoc(doc(db, 'equipment', equipmentId), targetEq, { merge: true });
      } catch (e) {
        console.warn('Firestore write equipment fallback to local cache:', e);
      }
    }
  }

  // Questions
  public getChecklistQuestions(): ChecklistQuestion[] {
    if (!this.isClient()) return INITIAL_CHECKLIST_QUESTIONS;
    this.init();
    const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    return data ? JSON.parse(data) : INITIAL_CHECKLIST_QUESTIONS;
  }

  // Inspections
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
    generalNotes?: string;
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
        changedById: data.userId,
        changedByName: data.userName,
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
        equipmentName: flag.equipmentName,
        reportedById: data.userId,
        reportedByName: data.userName,
        reportedAt: nowIso,
        dateString: dateStr,
        inspectionId,
        title: flag.title,
        description: flag.description,
        status: 'open',
        statusLogs: [initialLog]
      };

      newIssues.push(newIssue);

      // Update equipment status if linked
      if (flag.equipmentId) {
        this.updateEquipmentStatus(flag.equipmentId, 'flagged', issueId);
      }

      // Sync Issue to Firestore
      if (db) {
        setDoc(doc(db, 'issues', issueId), newIssue).catch((e) =>
          console.warn('Firestore issue write error:', e)
        );
      }
    });

    const status: Inspection['status'] = newIssues.length > 0 ? 'issues_found' : 'passed';

    const newInspection: Inspection = {
      id: inspectionId,
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      status,
      startedAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
      submittedAt: nowIso,
      dateString: dateStr,
      responses: data.responses,
      issueIds,
      generalNotes: data.generalNotes
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
      currentUserId: data.userId,
      currentUserName: data.userName,
      currentUserStartTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      lastInspectionId: inspectionId,
      lastInspectionStatus: status,
      lastInspectionAt: nowIso
    };
    this.updateVehicle(updatedVehicle);

    // Sync Inspection to Firestore
    if (db) {
      setDoc(doc(db, 'inspections', inspectionId), newInspection).catch((e) =>
        console.warn('Firestore inspection write error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return { inspection: newInspection, newIssues };
  }

  // Issues
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
      resolvedAt: newStatus === 'fixed' ? nowIso : issue.resolvedAt,
      resolvedById: newStatus === 'fixed' ? changedBy.id : issue.resolvedById,
      resolvedByName: newStatus === 'fixed' ? changedBy.name : issue.resolvedByName,
      resolutionNotes: newStatus === 'fixed' ? notes : issue.resolutionNotes
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

    // Sync to Firestore
    if (db) {
      setDoc(doc(db, 'issues', issueId), updatedIssue, { merge: true }).catch((e) =>
        console.warn('Firestore update issue status error:', e)
      );
    }

    window.dispatchEvent(new Event('sunny_db_update'));
    return updatedIssue;
  }
}

export const dbService = new DataStore();
