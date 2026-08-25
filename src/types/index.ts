export type UserRole = 'employee' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatarUrl?: string;
  avatarStyle?: 'circle' | 'rounded' | 'square';
  /**
   * Per-user sign-in code. A manager's passcode unlocks the manager view;
   * an employee's passcode signs in with employee permissions.
   * Stored in plain text alongside the rest of the demo fleet data.
   */
  passcode?: string;
  /**
   * ISO expiry of a temporary manager grant. While in the future the account
   * has an effective role of 'manager' without being a true manager, so it
   * cannot manage accounts or grant elevation onward.
   */
  tempManagerUntil?: string | null;
}

/** Persisted passcode session. Expires after a work shift; see SESSION_TTL_MS. */
export interface AuthSession {
  userId: string;
  role: UserRole;
  issuedAt: string;
  expiresAt: string;
}

export type VehicleStatus = 'active' | 'in_use' | 'maintenance' | 'inactive';
export type InspectionStatus = 'passed' | 'issues_found' | 'in_progress';

export interface Vehicle {
  id: string;
  vehicleNumber: string; // e.g. "Van #1"
  name: string; // e.g. "Ford Transit 250 - Pro Detailing"
  licensePlate: string; // e.g. "8U9-SUN"
  qrCodeToken: string; // e.g. "van-1"
  status: VehicleStatus;
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserStartTime?: string | null;
  lastInspectionId?: string | null;
  lastInspectionStatus?: InspectionStatus | null;
  lastInspectionAt?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
}

export type EquipmentCategory = 'equipment' | 'supplies' | 'vehicle_condition';
export type EquipmentStatus = 'working' | 'flagged' | 'needs_repair' | 'being_repaired' | 'fixed';
export type EquipmentKind = 'reusable' | 'consumable';

export interface EquipmentAssignment {
  vehicleId: string;
  vehicleNumber: string;
  quantity: number;
  requiredQuantity?: number;
}

export interface Equipment {
  id: string;
  /** Legacy single assignment fields. New shared inventory may leave these empty. */
  vehicleId?: string | null;
  vehicleNumber?: string | null;
  name: string;
  assetTag?: string | null;
  category: EquipmentCategory;
  kind?: EquipmentKind;
  equipmentType?: EquipmentKind;
  isConsumable?: boolean;
  /** Optional QR token/code used by the equipment scan flow. */
  qrCodeToken?: string | null;
  qrCode?: string | null;
  qrToken?: string | null;
  /** Total stock for consumables (reusable items default to one). */
  totalQuantity?: number;
  availableQuantity?: number;
  assignments?: EquipmentAssignment[];
  status: EquipmentStatus;
  activeIssueId?: string | null;
  lastCheckedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ChecklistCategory = string;

export interface ChecklistCategoryConfig {
  id: string;
  title: string;
  subtitle: string;
  order: number;
  iconName?: string;
}

export interface ChecklistConfig {
  id: string;
  name: string;
  categories: ChecklistCategoryConfig[];
  questions: ChecklistQuestion[];
  updatedAt?: string;
}

export type QuestionType = 
  | 'pass_fail'
  | 'yes_no'
  | 'text'
  | 'equipment_status'
  | 'checkbox'
  | 'multiple_choice';

export interface ChecklistQuestion {
  id: string;
  category: ChecklistCategory;
  text: string;
  type: QuestionType;
  required: boolean;
  order: number;
  equipmentId?: string;
  equipmentName?: string;
  options?: string[];
  reasonPresets?: string[];
  helperText?: string;
}

export interface InspectionResponse {
  questionId: string;
  questionText: string;
  category: ChecklistCategory;
  value: string | boolean;
  isFlagged: boolean;
  notes?: string;
  equipmentId?: string;
  equipmentName?: string;
}

export interface Inspection {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: InspectionStatus;
  startedAt: string;
  submittedAt: string;
  dateString: string; // YYYY-MM-DD
  responses: InspectionResponse[];
  issueIds: string[];
  generalNotes?: string;
  scheduleLabel?: string | null;
  scheduledAt?: string | null;
  taskId?: string | null;
}

export type TaskStatus = 'open' | 'completed';

export interface FleetTask {
  id: string;
  title: string;
  description?: string;
  vehicleId?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  dueAt?: string | null;
  scheduleLabel?: string | null;
  status: TaskStatus;
  createdById: string;
  createdByName: string;
  createdAt: string;
  completedAt?: string | null;
  completedInspectionId?: string | null;
}

export interface EquipmentOption {
  id: string;
  name: string;
  category: EquipmentCategory;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSettings {
  enabledMetrics: string[];
  updatedAt?: string;
}

export type IssueStatus = 'open' | 'needs_repair' | 'being_repaired' | 'fixed';

export type IssueType =
  | 'stock_low_inventory'
  | 'equipment_replacement'
  | 'needs_repair';

export interface AppSettings {
  recentInspectorsDepth: 1 | 3;
}

export interface IssueStatusLog {
  id: string;
  issueId: string;
  changedById: string;
  changedByName: string;
  oldStatus: IssueStatus | 'created';
  newStatus: IssueStatus;
  notes: string;
  timestamp: string;
}

export interface Issue {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  equipmentId?: string | null;
  equipmentName: string;
  reportedById: string;
  reportedByName: string;
  reportedAt: string;
  dateString: string; // YYYY-MM-DD
  inspectionId?: string | null;
  title: string;
  description: string;
  status: IssueStatus;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  resolvedByName?: string | null;
  resolutionNotes?: string | null;
  statusLogs?: IssueStatusLog[];
  type?: IssueType | null;
  reportedQuantity?: number | null;
  requiredQuantity?: number | null;
}
