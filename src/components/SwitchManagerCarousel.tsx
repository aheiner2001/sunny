'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  ClipboardCheck,
  Wrench,
  Clock,
  AlertTriangle,
  Bell,
  Users,
  BarChart3,
  Settings,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { playSwitchSound } from '@/lib/switchAudio';
import { dbService } from '@/lib/db';

interface SwitchAppTile {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ElementType;
  accentColor: string;
  badge?: number | string;
}

export function SwitchManagerCarousel() {
  const router = useRouter();
  const [activeTitle, setActiveTitle] = useState('Vehicles & Fleet');
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);

  useEffect(() => {
    const refreshStats = () => {
      try {
        const pending = dbService.getInspectionAlerts().filter(a => a.status === 'pending').length;
        const issues = dbService.getIssues().filter(i => i.status === 'open').length;
        const vehicles = dbService.getVehicles().length;
        setPendingAlerts(pending);
        setOpenIssues(issues);
        setActiveVehicles(vehicles);
      } catch {
        // Safe fallback
      }
    };
    refreshStats();
    window.addEventListener('sunny_db_update', refreshStats);
    return () => window.removeEventListener('sunny_db_update', refreshStats);
  }, []);

  const apps: SwitchAppTile[] = [
    {
      title: 'Vehicles & Fleet',
      subtitle: `${activeVehicles} active units`,
      href: '/vehicles',
      icon: Truck,
      accentColor: '#00c3e3',
      badge: activeVehicles > 0 ? activeVehicles : undefined,
    },
    {
      title: 'Inspections',
      subtitle: 'Audit logs & submissions',
      href: '/inspections',
      icon: ClipboardCheck,
      accentColor: '#10b981',
    },
    {
      title: 'Pending Alerts',
      subtitle: 'Awaiting manager sign-off',
      href: '/pending',
      icon: Bell,
      accentColor: '#ff4554',
      badge: pendingAlerts > 0 ? pendingAlerts : undefined,
    },
    {
      title: 'Issues & Repairs',
      subtitle: 'Open fleet trouble tickets',
      href: '/issues',
      icon: AlertTriangle,
      accentColor: '#f59e0b',
      badge: openIssues > 0 ? openIssues : undefined,
    },
    {
      title: 'Equipment & Supplies',
      subtitle: 'Tools, lifespans & restock',
      href: '/equipment',
      icon: Wrench,
      accentColor: '#8b5cf6',
    },
    {
      title: 'Timesheets',
      subtitle: 'Employee clock hours & audit',
      href: '/timesheets',
      icon: Clock,
      accentColor: '#06b6d4',
    },
    {
      title: 'Calendar Schedule',
      subtitle: 'Inspections & events timeline',
      href: '/calendar',
      icon: CalendarDays,
      accentColor: '#3b82f6',
    },
    {
      title: 'Employee Roster',
      subtitle: 'Passcodes & certifications',
      href: '/employees',
      icon: Users,
      accentColor: '#ec4899',
    },
    {
      title: 'Analytics & Reports',
      subtitle: 'Export PDF / CSV statistics',
      href: '/reports',
      icon: BarChart3,
      accentColor: '#6366f1',
    },
    {
      title: 'System Settings',
      subtitle: 'Form configs & database reset',
      href: '/settings',
      icon: Settings,
      accentColor: '#64748b',
    },
  ];

  return (
    <section className="w-full my-6 select-none">
      {/* Active App Heading (Switch Style) */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div>
          <span className="text-[11px] font-extrabold tracking-wider text-[#888] uppercase">
            Switch Home Application Menu
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#222] tracking-tight">
            {activeTitle}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#888] bg-white px-3 py-1.5 rounded-full border border-[#dadada] shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#00c3e3]" />
          <span>Nintendo Switch Mode</span>
        </div>
      </div>

      {/* Horizontal Carousel of Switch Cards */}
      <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-2 px-2 snap-x scrollbar-thin">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <Link
              key={app.href}
              href={app.href}
              onMouseEnter={() => {
                setActiveTitle(app.title);
                playSwitchSound('klick', 0.25);
              }}
              onClick={() => {
                playSwitchSound('popup');
              }}
              className="switch-glow group relative flex-shrink-0 w-44 sm:w-52 h-44 sm:h-52 rounded-2xl bg-white border-2 border-[#d5d5d5] p-4 flex flex-col justify-between shadow-sm cursor-pointer snap-start"
            >
              {/* Badge */}
              {app.badge !== undefined && (
                <span className="absolute top-3 right-3 min-w-6 h-6 px-1.5 rounded-full bg-[#ff4554] text-white text-xs font-black flex items-center justify-center border-2 border-white shadow-sm">
                  {app.badge}
                </span>
              )}

              {/* Large Icon Box */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm"
                style={{ backgroundColor: `${app.accentColor}18`, color: app.accentColor }}
              >
                <Icon className="w-7 h-7 stroke-[2.2]" />
              </div>

              {/* Card Title & Subtitle */}
              <div>
                <h3 className="font-extrabold text-base text-[#222] group-hover:text-[#00c3e3] transition-colors leading-tight">
                  {app.title}
                </h3>
                <p className="text-xs text-[#777] font-medium mt-1 truncate">
                  {app.subtitle}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
