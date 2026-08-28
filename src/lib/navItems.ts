import type { LucideIcon } from 'lucide-react';
import {
  Home,
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

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  managerOnly?: boolean;
  employeeOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/home', icon: Home, employeeOnly: true },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, managerOnly: true },
  { label: 'Vehicles', href: '/vehicles', icon: Truck, managerOnly: true },
  { label: 'Inspections', href: '/inspections', icon: ClipboardCheck },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays, managerOnly: true },
  { label: 'Equipment', href: '/equipment', icon: Wrench, managerOnly: true },
  { label: 'Issues', href: '/issues', icon: AlertTriangle, managerOnly: true },
  { label: 'Employees', href: '/employees', icon: Users, managerOnly: true },
  { label: 'Reports', href: '/reports', icon: BarChart3, managerOnly: true },
  { label: 'Settings', href: '/settings', icon: Settings, managerOnly: true },
];
