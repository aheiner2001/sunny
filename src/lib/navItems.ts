import {
  LayoutDashboard,
  Truck,
  ClipboardCheck,
  CalendarDays,
  Wrench,
  AlertTriangle,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, managerOnly: false },
  { label: 'Vehicles', href: '/vehicles', icon: Truck, managerOnly: true },
  { label: 'Inspections', href: '/inspections', icon: ClipboardCheck, managerOnly: false },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays, managerOnly: true },
  { label: 'Equipment', href: '/equipment', icon: Wrench, managerOnly: true },
  { label: 'Issues', href: '/issues', icon: AlertTriangle, managerOnly: true },
  { label: 'Employees', href: '/employees', icon: Users, managerOnly: true },
  { label: 'Reports', href: '/reports', icon: BarChart3, managerOnly: true },
  { label: 'Settings', href: '/settings', icon: Settings, managerOnly: true },
];
