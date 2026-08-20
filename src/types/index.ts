export type UserRole = 'employee' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatarUrl?: string;
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
  createdAt?: string;
}

export type EquipmentCategory = 'equipment' | 'supplies' | 'vehicle_condition';
export type EquipmentStatus = 'working' | 'flagged' | 'needs_repair' | 'being_repaired' | 'fixed';

export interface Equipment {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  name: string;
  category: EquipmentCategory;
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
}
