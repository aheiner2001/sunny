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
  QrCode,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { asset } from '@/lib/basePath';

const NAV_ITEMS = [
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
    <aside className="w-64 bg-white border-r border-slate-200/80 min-h-screen flex flex-col justify-between shrink-0 select-none shadow-sm z-30">
      <div>
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-slate-100">
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
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-sky-50 text-sky-600 font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
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
          className="group block p-4 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100/70 transition-all text-left shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30 group-hover:scale-105 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 group-hover:text-sky-700 flex items-center gap-1">
                Scan Vehicle QR
                <Sparkles className="w-3 h-3 text-amber-500" />
              </div>
              <p className="text-xs text-sky-600 font-medium">
                Start Inspection
              </p>
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
