import { User, Vehicle, Equipment, ChecklistQuestion, Inspection, Issue } from '@/types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-jacob',
    name: 'Jacob Heiner',
    email: 'jacob@sunnyfleet.com',
    role: 'manager',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-john',
    name: 'John Smith',
    email: 'john@sunnyfleet.com',
    role: 'employee',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-sarah',
    name: 'Sarah Johnson',
    email: 'sarah@sunnyfleet.com',
    role: 'employee',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-mike',
    name: 'Mike Davis',
    email: 'mike@sunnyfleet.com',
    role: 'employee',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-emily',
    name: 'Emily Wilson',
    email: 'emily@sunnyfleet.com',
    role: 'employee',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-chris',
    name: 'Chris Brown',
    email: 'chris@sunnyfleet.com',
    role: 'employee',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'van-1',
    vehicleNumber: 'Van #1',
    name: 'Ford Transit 250 - Detailing Rig A',
    licensePlate: '8U9-SUN',
    qrCodeToken: 'van-1',
    status: 'in_use',
    currentUserId: 'user-john',
    currentUserName: 'John Smith',
    currentUserStartTime: '7:30 AM',
    lastInspectionId: 'insp-1',
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-19T08:15:00Z',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'van-2',
    vehicleNumber: 'Van #2',
    name: 'Ford Transit 250 - Detailing Rig B',
    licensePlate: '4X2-SUN',
    qrCodeToken: 'van-2',
    status: 'in_use',
    currentUserId: 'user-sarah',
    currentUserName: 'Sarah Johnson',
    currentUserStartTime: '7:45 AM',
    lastInspectionId: 'insp-2',
    lastInspectionStatus: 'issues_found',
    lastInspectionAt: '2026-08-19T07:58:00Z',
    createdAt: '2026-01-12T00:00:00Z',
  },
  {
    id: 'van-3',
    vehicleNumber: 'Van #3',
    name: 'Ram ProMaster 2500 - Ceramic Pro Rig',
    licensePlate: '7Y1-SUN',
    qrCodeToken: 'van-3',
    status: 'in_use',
    currentUserId: 'user-mike',
    currentUserName: 'Mike Davis',
    currentUserStartTime: '7:20 AM',
    lastInspectionId: 'insp-3',
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-19T08:42:00Z',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'van-4',
    vehicleNumber: 'Van #4',
    name: 'Mercedes Sprinter 2500 - Fleet Rig',
    licensePlate: '9K3-SUN',
    qrCodeToken: 'van-4',
    status: 'in_use',
    currentUserId: 'user-emily',
    currentUserName: 'Emily Wilson',
    currentUserStartTime: '7:10 AM',
    lastInspectionId: 'insp-4',
    lastInspectionStatus: 'in_progress',
    lastInspectionAt: '2026-08-19T07:20:00Z',
    createdAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'van-5',
    vehicleNumber: 'Van #5',
    name: 'Ford Transit 150 - Express Detailer',
    licensePlate: '3Z8-SUN',
    qrCodeToken: 'van-5',
    status: 'in_use',
    currentUserId: 'user-chris',
    currentUserName: 'Chris Brown',
    currentUserStartTime: '7:05 AM',
    lastInspectionId: 'insp-5',
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-19T07:41:00Z',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'van-6',
    vehicleNumber: 'Van #6',
    name: 'Ford Transit 250 - Interior Rig',
    licensePlate: '5V4-SUN',
    qrCodeToken: 'van-6',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-18T16:30:00Z',
    createdAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'van-7',
    vehicleNumber: 'Van #7',
    name: 'Ram ProMaster 1500 - Mobile Wash',
    licensePlate: '2M9-SUN',
    qrCodeToken: 'van-7',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-18T17:15:00Z',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'van-8',
    vehicleNumber: 'Van #8',
    name: 'Mercedes Sprinter - Polishing Unit',
    licensePlate: '1L7-SUN',
    qrCodeToken: 'van-8',
    status: 'maintenance',
    currentUserId: null,
    currentUserName: null,
    lastInspectionStatus: 'issues_found',
    lastInspectionAt: '2026-08-17T09:00:00Z',
    createdAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'van-9',
    vehicleNumber: 'Van #9',
    name: 'Ford Transit 250 - Tint & PPF Rig',
    licensePlate: '6P2-SUN',
    qrCodeToken: 'van-9',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-18T14:20:00Z',
    createdAt: '2026-04-10T00:00:00Z',
  },
  {
    id: 'van-10',
    vehicleNumber: 'Van #10',
    name: 'Ram ProMaster 2500 - Water Tank Unit',
    licensePlate: '7H8-SUN',
    qrCodeToken: 'van-10',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-18T11:00:00Z',
    createdAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'van-11',
    vehicleNumber: 'Van #11',
    name: 'Ford Transit 150 - Rapid Detailer',
    licensePlate: '9J5-SUN',
    qrCodeToken: 'van-11',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-18T08:30:00Z',
    createdAt: '2026-05-15T00:00:00Z',
  },
  {
    id: 'van-12',
    vehicleNumber: 'Van #12',
    name: 'Mercedes Sprinter - Coating Lab',
    licensePlate: '4K1-SUN',
    qrCodeToken: 'van-12',
    status: 'active',
    currentUserId: null,
    currentUserName: null,
    lastInspectionStatus: 'passed',
    lastInspectionAt: '2026-08-18T15:45:00Z',
    createdAt: '2026-06-01T00:00:00Z',
  }
];

export const INITIAL_EQUIPMENT: Equipment[] = [
  // Van #1 Equipment
  { id: 'eq-1-1', vehicleId: 'van-1', vehicleNumber: 'Van #1', name: 'Air Compressor 200 PSI', category: 'equipment', status: 'working' },
  { id: 'eq-1-2', vehicleId: 'van-1', vehicleNumber: 'Van #1', name: 'Commercial Pressure Washer', category: 'equipment', status: 'flagged', activeIssueId: 'issue-3' },
  { id: 'eq-1-3', vehicleId: 'van-1', vehicleNumber: 'Van #1', name: 'Heated Carpet Extractor', category: 'equipment', status: 'working' },
  { id: 'eq-1-4', vehicleId: 'van-1', vehicleNumber: 'Van #1', name: '50ft High-Pressure Hose Reel', category: 'equipment', status: 'working' },
  { id: 'eq-1-5', vehicleId: 'van-1', vehicleNumber: 'Van #1', name: 'Microfiber Towel Crate (50ct)', category: 'supplies', status: 'working' },
  
  // Van #2 Equipment
  { id: 'eq-2-1', vehicleId: 'van-2', vehicleNumber: 'Van #2', name: 'Air Compressor 150 PSI', category: 'equipment', status: 'working' },
  { id: 'eq-2-2', vehicleId: 'van-2', vehicleNumber: 'Van #2', name: 'Vacuum Hose & Claw Nozzle', category: 'equipment', status: 'flagged', activeIssueId: 'issue-2' },
  { id: 'eq-2-3', vehicleId: 'van-2', vehicleNumber: 'Van #2', name: 'Pressure Washer Honda GX390', category: 'equipment', status: 'working' },
  { id: 'eq-2-4', vehicleId: 'van-2', vehicleNumber: 'Van #2', name: 'Chemical Spray Caddy (8 Bottles)', category: 'supplies', status: 'working' },
  
  // Van #3 Equipment
  { id: 'eq-3-1', vehicleId: 'van-3', vehicleNumber: 'Van #3', name: 'Air Compressor', category: 'equipment', status: 'flagged', activeIssueId: 'issue-1' },
  { id: 'eq-3-2', vehicleId: 'van-3', vehicleNumber: 'Van #3', name: 'Rupes Bigfoot Rotary Polisher', category: 'equipment', status: 'working' },
  { id: 'eq-3-3', vehicleId: 'van-3', vehicleNumber: 'Van #3', name: 'Ceramic Coating Kit Case', category: 'supplies', status: 'working' },
  { id: 'eq-3-4', vehicleId: 'van-3', vehicleNumber: 'Van #3', name: 'Foam Cannon & Quick Connect', category: 'equipment', status: 'working' },

  // Van #4 Equipment
  { id: 'eq-4-1', vehicleId: 'van-4', vehicleNumber: 'Van #4', name: 'Extension Pole (24ft Telescopic)', category: 'equipment', status: 'being_repaired', activeIssueId: 'issue-5' },
  { id: 'eq-4-2', vehicleId: 'van-4', vehicleNumber: 'Van #4', name: 'Heavy Duty Extractor Vacuum', category: 'equipment', status: 'working' },
  { id: 'eq-4-3', vehicleId: 'van-4', vehicleNumber: 'Van #4', name: 'High-Pressure Gun & Lances', category: 'equipment', status: 'working' },

  // Van #5 Equipment
  { id: 'eq-5-1', vehicleId: 'van-5', vehicleNumber: 'Van #5', name: 'Window Squeegee Pro Set', category: 'equipment', status: 'being_repaired', activeIssueId: 'issue-4' },
  { id: 'eq-5-2', vehicleId: 'van-5', vehicleNumber: 'Van #5', name: 'Dual Action Buffer', category: 'equipment', status: 'working' },
  { id: 'eq-5-3', vehicleId: 'van-5', vehicleNumber: 'Van #5', name: 'Steam Machine Optima Steamer', category: 'equipment', status: 'working' }
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
    helperText: 'Empty waste canister if full.'
  },
  {
    id: 'q-eq-4',
    category: 'equipment',
    text: 'Polishers & Window Squeegees: Clean pads, smooth operation, blades intact',
    type: 'equipment_status',
    required: true,
    order: 4,
    equipmentName: 'Polisher / Squeegee',
    helperText: 'Ensure backing plates are tightened.'
  },

  // Supplies Category
  {
    id: 'q-sup-1',
    category: 'supplies',
    text: 'Microfiber Towel Supply: At least 30 clean towels stocked',
    type: 'pass_fail',
    required: true,
    order: 5,
    helperText: 'Separate paint, glass, and wheel towels.'
  },
  {
    id: 'q-sup-2',
    category: 'supplies',
    text: 'Chemical Caddy: All essential bottles filled (Soap, APC, Wheel Cleaner, Glass Cleaner)',
    type: 'pass_fail',
    required: true,
    order: 6,
    helperText: 'Check triggers spray properly.'
  },
  {
    id: 'q-sup-3',
    category: 'supplies',
    text: 'Tire Shine & Dressings: Adequate bottle volume for full route',
    type: 'pass_fail',
    required: true,
    order: 7
  },

  // Vehicle Condition
  {
    id: 'q-veh-1',
    category: 'vehicle_condition',
    text: 'Dashboard Warning Lights: No check engine, ABS, or tire pressure lights',
    type: 'pass_fail',
    required: true,
    order: 8,
    helperText: 'Key in ON position; verify dash lamps clear.'
  },
  {
    id: 'q-veh-2',
    category: 'vehicle_condition',
    text: 'Exterior Body & Sunny Fleet Wrap: Free from new dents, scratches, or peeling',
    type: 'pass_fail',
    required: true,
    order: 9
  },
  {
    id: 'q-veh-3',
    category: 'vehicle_condition',
    text: 'Fuel Level & Water Tank: Fuel > 1/2 tank, fresh water tank full',
    type: 'pass_fail',
    required: true,
    order: 10
  },

  // Previous User Condition
  {
    id: 'q-prev-1',
    category: 'previous_user_condition',
    text: 'Cab Cleanliness: Prior operator left driver cab clean and trash-free',
    type: 'yes_no',
    required: true,
    order: 11
  },
  {
    id: 'q-prev-2',
    category: 'previous_user_condition',
    text: 'Equipment Stowed: Prior operator rolled all hoses and secured heavy gear',
    type: 'yes_no',
    required: true,
    order: 12
  },
  {
    id: 'q-prev-3',
    category: 'previous_user_condition',
    text: 'Chemical Caps Secured: No spilled fluids or unsealed bottles in cargo bay',
    type: 'yes_no',
    required: true,
    order: 13
  }
];

export const INITIAL_ISSUES: Issue[] = [
  {
    id: 'issue-1',
    vehicleId: 'van-3',
    vehicleNumber: 'Van #3',
    equipmentId: 'eq-3-1',
    equipmentName: 'Air Compressor',
    reportedById: 'user-john',
    reportedByName: 'John Smith',
    reportedAt: '2026-08-12T07:45:00Z',
    dateString: '2026-08-12',
    inspectionId: 'insp-legacy-1',
    title: 'Air Compressor losing pressure',
    description: 'Compressor cycles frequently and cannot build above 90 PSI under load. Suspected regulator seal leak.',
    status: 'open',
    statusLogs: [
      {
        id: 'log-1-1',
        issueId: 'issue-1',
        changedById: 'user-john',
        changedByName: 'John Smith',
        oldStatus: 'created',
        newStatus: 'open',
        notes: 'Flagged during morning pre-trip inspection.',
        timestamp: '2026-08-12T07:45:00Z'
      },
      {
        id: 'log-1-2',
        issueId: 'issue-1',
        changedById: 'user-jacob',
        changedByName: 'Jacob Heiner',
        oldStatus: 'open',
        newStatus: 'needs_repair',
        notes: 'Inspected regulator valve. Ordered replacement OEM seal kit #AG-441.',
        timestamp: '2026-08-13T10:15:00Z'
      },
      {
        id: 'log-1-3',
        issueId: 'issue-1',
        changedById: 'user-jacob',
        changedByName: 'Jacob Heiner',
        oldStatus: 'needs_repair',
        newStatus: 'open',
        notes: 'Part arrived, awaiting technician maintenance bay opening.',
        timestamp: '2026-08-16T14:30:00Z'
      }
    ]
  },
  {
    id: 'issue-2',
    vehicleId: 'van-2',
    vehicleNumber: 'Van #2',
    equipmentId: 'eq-2-2',
    equipmentName: 'Vacuum Hose',
    reportedById: 'user-sarah',
    reportedByName: 'Sarah Johnson',
    reportedAt: '2026-08-18T07:58:00Z',
    dateString: '2026-08-18',
    inspectionId: 'insp-2',
    title: 'Vacuum hose cuff tear',
    description: 'Noticeable 2-inch slit in hose near claw attachment causing whistling and ~40% suction loss.',
    status: 'open',
    statusLogs: [
      {
        id: 'log-2-1',
        issueId: 'issue-2',
        changedById: 'user-sarah',
        changedByName: 'Sarah Johnson',
        oldStatus: 'created',
        newStatus: 'open',
        notes: 'Reported upon vehicle pickup inspection.',
        timestamp: '2026-08-18T07:58:00Z'
      }
    ]
  },
  {
    id: 'issue-3',
    vehicleId: 'van-1',
    vehicleNumber: 'Van #1',
    equipmentId: 'eq-1-2',
    equipmentName: 'Pressure Washer',
    reportedById: 'user-sarah',
    reportedByName: 'Sarah Johnson',
    reportedAt: '2026-08-18T08:15:00Z',
    dateString: '2026-08-18',
    inspectionId: 'insp-1',
    title: 'Trigger gun safety lock broken',
    description: 'Safety switch latch on trigger wand is snapped off; gun can fire if bumped.',
    status: 'open',
    statusLogs: [
      {
        id: 'log-3-1',
        issueId: 'issue-3',
        changedById: 'user-sarah',
        changedByName: 'Sarah Johnson',
        oldStatus: 'created',
        newStatus: 'open',
        notes: 'Safety concern logged. Needs new lance gun assembly.',
        timestamp: '2026-08-18T08:15:00Z'
      }
    ]
  },
  {
    id: 'issue-4',
    vehicleId: 'van-5',
    vehicleNumber: 'Van #5',
    equipmentId: 'eq-5-1',
    equipmentName: 'Window Squeegee',
    reportedById: 'user-chris',
    reportedByName: 'Chris Brown',
    reportedAt: '2026-08-14T08:00:00Z',
    dateString: '2026-08-14',
    inspectionId: 'insp-legacy-4',
    title: 'Squeegee blade nicked & streaking',
    description: 'Rubber blade has a notch in the middle leaving 1-inch water streak across rear windshields.',
    status: 'being_repaired',
    statusLogs: [
      {
        id: 'log-4-1',
        issueId: 'issue-4',
        changedById: 'user-chris',
        changedByName: 'Chris Brown',
        oldStatus: 'created',
        newStatus: 'open',
        notes: 'Blade worn out.',
        timestamp: '2026-08-14T08:00:00Z'
      },
      {
        id: 'log-4-2',
        issueId: 'issue-4',
        changedById: 'user-jacob',
        changedByName: 'Jacob Heiner',
        oldStatus: 'open',
        newStatus: 'being_repaired',
        notes: 'New silicon blade inserted, testing in progress.',
        timestamp: '2026-08-17T11:20:00Z'
      }
    ]
  },
  {
    id: 'issue-5',
    vehicleId: 'van-4',
    vehicleNumber: 'Van #4',
    equipmentId: 'eq-4-1',
    equipmentName: 'Extension Pole',
    reportedById: 'user-emily',
    reportedByName: 'Emily Wilson',
    reportedAt: '2026-08-15T07:15:00Z',
    dateString: '2026-08-15',
    inspectionId: 'insp-legacy-5',
    title: 'Locking collar slipping on extension pole',
    description: 'Twist lock mechanism on upper section does not hold under downward pressure when cleaning RV roofs.',
    status: 'being_repaired',
    statusLogs: [
      {
        id: 'log-5-1',
        issueId: 'issue-5',
        changedById: 'user-emily',
        changedByName: 'Emily Wilson',
        oldStatus: 'created',
        newStatus: 'open',
        notes: 'Collar threads stripped.',
        timestamp: '2026-08-15T07:15:00Z'
      },
      {
        id: 'log-5-2',
        issueId: 'issue-5',
        changedById: 'user-jacob',
        changedByName: 'Jacob Heiner',
        oldStatus: 'open',
        newStatus: 'being_repaired',
        notes: 'Disassembled collar; replacing friction wedge ring.',
        timestamp: '2026-08-18T09:00:00Z'
      }
    ]
  }
];

export const INITIAL_INSPECTIONS: Inspection[] = [
  {
    id: 'insp-3',
    vehicleId: 'van-3',
    vehicleNumber: 'Van #3',
    userId: 'user-john',
    userName: 'John Smith',
    userEmail: 'john@sunnyfleet.com',
    status: 'passed',
    startedAt: '2026-08-19T08:35:00Z',
    submittedAt: '2026-08-19T08:42:00Z',
    dateString: '2026-08-19',
    responses: [],
    issueIds: [],
    generalNotes: 'Van prepped for full ceramic job in Sandy.'
  },
  {
    id: 'insp-1',
    vehicleId: 'van-1',
    vehicleNumber: 'Van #1',
    userId: 'user-sarah',
    userName: 'Sarah Johnson',
    userEmail: 'sarah@sunnyfleet.com',
    status: 'passed',
    startedAt: '2026-08-19T08:05:00Z',
    submittedAt: '2026-08-19T08:15:00Z',
    dateString: '2026-08-19',
    responses: [],
    issueIds: ['issue-3'],
    generalNotes: 'All good except noted pressure washer safety trigger.'
  },
  {
    id: 'insp-2',
    vehicleId: 'van-2',
    vehicleNumber: 'Van #2',
    userId: 'user-mike',
    userName: 'Mike Davis',
    userEmail: 'mike@sunnyfleet.com',
    status: 'issues_found',
    startedAt: '2026-08-19T07:48:00Z',
    submittedAt: '2026-08-19T07:58:00Z',
    dateString: '2026-08-19',
    responses: [],
    issueIds: ['issue-2'],
    generalNotes: 'Hose damaged.'
  },
  {
    id: 'insp-5',
    vehicleId: 'van-5',
    vehicleNumber: 'Van #5',
    userId: 'user-chris',
    userName: 'Chris Brown',
    userEmail: 'chris@sunnyfleet.com',
    status: 'passed',
    startedAt: '2026-08-19T07:30:00Z',
    submittedAt: '2026-08-19T07:41:00Z',
    dateString: '2026-08-19',
    responses: [],
    issueIds: []
  },
  {
    id: 'insp-4',
    vehicleId: 'van-4',
    vehicleNumber: 'Van #4',
    userId: 'user-emily',
    userName: 'Emily Wilson',
    userEmail: 'emily@sunnyfleet.com',
    status: 'in_progress',
    startedAt: '2026-08-19T07:20:00Z',
    submittedAt: '2026-08-19T07:20:00Z',
    dateString: '2026-08-19',
    responses: [],
    issueIds: []
  },
  // Previous days for calendar indicators
  {
    id: 'insp-hist-1',
    vehicleId: 'van-1',
    vehicleNumber: 'Van #1',
    userId: 'user-john',
    userName: 'John Smith',
    userEmail: 'john@sunnyfleet.com',
    status: 'passed',
    startedAt: '2026-08-18T08:00:00Z',
    submittedAt: '2026-08-18T08:12:00Z',
    dateString: '2026-08-18',
    responses: [],
    issueIds: []
  },
  {
    id: 'insp-hist-2',
    vehicleId: 'van-2',
    vehicleNumber: 'Van #2',
    userId: 'user-sarah',
    userName: 'Sarah Johnson',
    userEmail: 'sarah@sunnyfleet.com',
    status: 'issues_found',
    startedAt: '2026-08-18T07:45:00Z',
    submittedAt: '2026-08-18T07:58:00Z',
    dateString: '2026-08-18',
    responses: [],
    issueIds: ['issue-2']
  },
  {
    id: 'insp-hist-3',
    vehicleId: 'van-3',
    vehicleNumber: 'Van #3',
    userId: 'user-mike',
    userName: 'Mike Davis',
    userEmail: 'mike@sunnyfleet.com',
    status: 'passed',
    startedAt: '2026-08-17T08:10:00Z',
    submittedAt: '2026-08-17T08:22:00Z',
    dateString: '2026-08-17',
    responses: [],
    issueIds: []
  },
  {
    id: 'insp-hist-4',
    vehicleId: 'van-4',
    vehicleNumber: 'Van #4',
    userId: 'user-emily',
    userName: 'Emily Wilson',
    userEmail: 'emily@sunnyfleet.com',
    status: 'issues_found',
    startedAt: '2026-08-15T07:05:00Z',
    submittedAt: '2026-08-15T07:15:00Z',
    dateString: '2026-08-15',
    responses: [],
    issueIds: ['issue-5']
  },
  {
    id: 'insp-hist-5',
    vehicleId: 'van-5',
    vehicleNumber: 'Van #5',
    userId: 'user-chris',
    userName: 'Chris Brown',
    userEmail: 'chris@sunnyfleet.com',
    status: 'issues_found',
    startedAt: '2026-08-14T07:50:00Z',
    submittedAt: '2026-08-14T08:00:00Z',
    dateString: '2026-08-14',
    responses: [],
    issueIds: ['issue-4']
  },
  {
    id: 'insp-hist-6',
    vehicleId: 'van-3',
    vehicleNumber: 'Van #3',
    userId: 'user-john',
    userName: 'John Smith',
    userEmail: 'john@sunnyfleet.com',
    status: 'issues_found',
    startedAt: '2026-08-12T07:35:00Z',
    submittedAt: '2026-08-12T07:45:00Z',
    dateString: '2026-08-12',
    responses: [],
    issueIds: ['issue-1']
  },
  {
    id: 'insp-hist-7',
    vehicleId: 'van-1',
    vehicleNumber: 'Van #1',
    userId: 'user-sarah',
    userName: 'Sarah Johnson',
    userEmail: 'sarah@sunnyfleet.com',
    status: 'passed',
    startedAt: '2026-08-06T08:00:00Z',
    submittedAt: '2026-08-06T08:14:00Z',
    dateString: '2026-08-06',
    responses: [],
    issueIds: []
  }
];
