'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  QrCode
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { asset } from '@/lib/basePath';

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

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();

  return (
    <aside className="w-64 bg-surface border-r border-line min-h-screen flex flex-col justify-between shrink-0 select-none z-30">
      <div>
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-line">
          <img
            src={asset('/sunny-logo.png')}
            alt="Sunny logo"
            className="h-12 w-36 object-contain object-left"
          />
        </div>

        {/* Nav links */}
        <nav className="p-4 space-y-1.5">
          {NAV_ITEMS.filter(item => !item.managerOnly || role === 'manager').map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-3.5 px-4 py-2.5 rounded-lg font-display text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-surface-sunk text-ink font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-ink'
                    : 'text-ink-muted font-medium hover:bg-surface-alt hover:text-ink'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-ink' : 'text-ink-faint'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom QR Scan Quick Launcher */}
      <div className="p-4">
        <Link
          href="/scan"
          className="group block p-4 rounded-card border border-dashed border-line-strong bg-surface-alt hover:border-ink hover:bg-surface-sunk transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="icon-tile w-10 h-10 bg-ink text-ink-inverse">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-display font-semibold text-ink">
                Scan vehicle QR
              </div>
              <p className="text-xs text-ink-muted m-0">
                Start an inspection
              </p>
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
