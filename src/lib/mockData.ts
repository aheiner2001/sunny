import { User, Vehicle, Equipment, ChecklistQuestion, ChecklistCategoryConfig, Inspection, Issue } from '@/types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-jacob',
    name: 'Jacob Heiner',
    email: 'jacob@sunnyfleet.com',
    role: 'manager',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    passcode: '4321',
  },
  {
    id: 'user-john',
    name: 'John Smith',
    email: 'john@sunnyfleet.com',
    role: 'employee',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    passcode: '1234',
  }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'van-1',
    vehicleNumber: 'Van #1',
    name: 'Ford Transit 250 - Pro Detailing',
    licensePlate: '8U9-SUN',
    qrCodeToken: 'van-1',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
    currentUserStartTime: null,
    lastInspectionId: null,
    lastInspectionStatus: null,
    lastInspectionAt: null,
    createdAt: '2026-08-19T08:00:00Z',
  }
];

export const INITIAL_EQUIPMENT: Equipment[] = [
  { 
    id: 'eq-1', 
    vehicleId: 'van-1', 
    vehicleNumber: 'Van #1', 
    name: 'Air Compressor 200 PSI', 
    category: 'equipment', 
    status: 'working',
    kind: 'reusable',
    totalQuantity: 1,
    availableQuantity: 0,
    assignments: [{ vehicleId: 'van-1', vehicleNumber: 'Van #1', quantity: 1 }],
    qrCodeToken: 'eq-1',
    activeIssueId: null,
    createdAt: '2026-08-19T08:00:00Z',
    updatedAt: '2026-08-19T08:00:00Z'
  }
];

export const INITIAL_CATEGORIES: ChecklistCategoryConfig[] = [
  { id: 'equipment', title: 'Equipment', subtitle: 'Compressor, pressure washer, vacuum, tools', order: 1, iconName: 'Wrench' },
  { id: 'supplies', title: 'Supplies', subtitle: 'Towels, chemicals, coatings, PPE', order: 2, iconName: 'Sparkles' },
  { id: 'vehicle_condition', title: 'Vehicle Condition', subtitle: 'Dashboard lights, wrap, tire pressure, fluids', order: 3, iconName: 'Truck' },
  { id: 'previous_user_condition', title: 'Previous User Check', subtitle: 'Cab cleanliness, gear stowed, trash removed', order: 4, iconName: 'ShieldCheck' },
];

export const INITIAL_CHECKLIST_QUESTIONS: ChecklistQuestion[] = [
  // Equipment Category
  {
    id: 'q-eq-1',
    category: 'equipment',
    text: 'Air Compressor: Functional & maintains pressure at 120+ PSI',
    type: 'equipment_status',
    required: true,
    order: 1,
    equipmentName: 'Air Compressor',
    reasonPresets: ['Won’t start', 'Low pressure', 'Air leak', 'Damaged hose'],
    helperText: 'Check oil level, drain valve closed, listen for leaks.'
  },
  {
    id: 'q-eq-2',
    category: 'equipment',
    text: 'Pressure Washer & Hoses: No leaks, cracks or safety latch issues',
    type: 'equipment_status',
    required: true,
    order: 2,
    equipmentName: 'Pressure Washer',
    reasonPresets: ['Hose leak', 'No pressure', 'Trigger issue', 'Cracked fitting'],
    helperText: 'Inspect hose braiding and spray trigger.'
  },
  {
    id: 'q-eq-3',
    category: 'equipment',
    text: 'Vacuum & Extractor: Suction strong, filters clean, hose intact',
    type: 'equipment_status',
    required: true,
    order: 3,
    equipmentName: 'Vacuum Extractor',
    reasonPresets: ['Weak suction', 'Filter blocked', 'Damaged hose', 'Missing part'],
    helperText: 'Empty waste canister if full.'
  },

  // Supplies Category
  {
    id: 'q-sup-1',
    category: 'supplies',
    text: 'Microfiber Towel Supply: At least 30 clean towels stocked',
    type: 'pass_fail',
    required: true,
    order: 4,
    helperText: 'Separate paint, glass, and wheel towels.',
    reasonPresets: ['Not enough towels', 'Towels are dirty', 'Wrong towel type']
  },
  {
    id: 'q-sup-2',
    category: 'supplies',
    text: 'Chemical Caddy: All essential bottles filled (Soap, APC, Wheel Cleaner, Glass Cleaner)',
    type: 'pass_fail',
    required: true,
    order: 5,
    helperText: 'Check triggers spray properly.',
    reasonPresets: ['Bottle empty', 'Sprayer broken', 'Missing chemical']
  },

  // Vehicle Condition
  {
    id: 'q-veh-1',
    category: 'vehicle_condition',
    text: 'Dashboard Warning Lights: No check engine, ABS, or tire pressure lights',
    type: 'pass_fail',
    required: true,
    order: 6,
    helperText: 'Key in ON position; verify dash lamps clear.'
  },
  {
    id: 'q-veh-2',
    category: 'vehicle_condition',
    text: 'Exterior Body & Sunny Fleet Wrap: Free from new dents, scratches, or peeling',
    type: 'pass_fail',
    required: true,
    order: 7
  },
  {
    id: 'q-veh-3',
    category: 'vehicle_condition',
    text: 'Fuel Level & Water Tank: Fuel > 1/2 tank, fresh water tank full',
    type: 'pass_fail',
    required: true,
    order: 8
  },

  // Previous User Condition
  {
    id: 'q-prev-1',
    category: 'previous_user_condition',
    text: 'Cab Cleanliness: Prior operator left driver cab clean and trash-free',
    type: 'yes_no',
    required: true,
    order: 9
  },
  {
    id: 'q-prev-2',
    category: 'previous_user_condition',
    text: 'Equipment Stowed: Prior operator rolled all hoses and secured heavy gear',
    type: 'yes_no',
    required: true,
    order: 10
  }
];

export const INITIAL_ISSUES: Issue[] = [];

export const INITIAL_INSPECTIONS: Inspection[] = [];
