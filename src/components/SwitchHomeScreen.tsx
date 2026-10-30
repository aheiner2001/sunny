'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck,
  Clock,
  Truck,
  Bell,
  GraduationCap,
  Wrench,
  AlertTriangle,
  Users,
  BarChart3,
  Settings,
  CalendarDays,
  Wifi,
  BatteryMedium,
  Image,
  Gamepad2,
  Power,
  QrCode
} from 'lucide-react';
import { playSwitchSound } from '@/lib/switchAudio';
import { dbService } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { getResolvedAvatarUrl } from '@/lib/avatarPresets';

interface SwitchAppTile {
  title: string;
  subtitle: string;
  href: string;
  imageSrc?: string;
  icon: React.ElementType;
  accentColor: string;
  badge?: number | string;
}

export function SwitchHomeScreen({
  onScanClick,
  onProfileClick
}: {
  onScanClick: () => void;
  onProfileClick: () => void;
}) {
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const avatarUrl = getResolvedAvatarUrl(user);
  const [timeStr, setTimeStr] = useState('12:00 PM');
  const [activeTitle, setActiveTitle] = useState('Inspections Log');
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

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

  // Ordered strictly according to daily manager priority with clean minimalist vector Switch app icons:
  const apps: SwitchAppTile[] = [
    {
      title: 'Inspections Log',
      subtitle: 'Completed vehicle audits',
      href: '/inspections',
      imageSrc: '/switch-icons/inspections.svg',
      icon: ClipboardCheck,
      accentColor: '#10b981',
    },
    {
      title: 'Timesheets',
      subtitle: 'Hours, edits & overtime',
      href: '/timesheets',
      imageSrc: '/switch-icons/timesheets.svg',
      icon: Clock,
      accentColor: '#00c3e3',
    },
    {
      title: 'Vehicles & Fleet',
      subtitle: `${activeVehicles} active units`,
      href: '/vehicles',
      imageSrc: '/switch-icons/vehicles.svg',
      icon: Truck,
      accentColor: '#0284c7',
      badge: activeVehicles > 0 ? activeVehicles : undefined,
    },
    {
      title: 'Pending Alerts',
      subtitle: 'Manager review queue',
      href: '/pending',
      imageSrc: '/switch-icons/pending.svg',
      icon: Bell,
      accentColor: '#ff4554',
      badge: pendingAlerts > 0 ? pendingAlerts : undefined,
    },
    {
      title: 'Training & Skills',
      subtitle: 'Certifications & modules',
      href: '/training',
      imageSrc: '/switch-icons/training.svg',
      icon: GraduationCap,
      accentColor: '#f59e0b',
    },
    {
      title: 'Equipment & Supplies',
      subtitle: 'Tools, stock & lifespans',
      href: '/equipment',
      imageSrc: '/switch-icons/equipment.svg',
      icon: Wrench,
      accentColor: '#8b5cf6',
    },
    {
      title: 'Issues & Repairs',
      subtitle: 'Fleet maintenance requests',
      href: '/issues',
      imageSrc: '/switch-icons/issues.svg',
      icon: AlertTriangle,
      accentColor: '#f97316',
      badge: openIssues > 0 ? openIssues : undefined,
    },
    {
      title: 'Calendar Schedule',
      subtitle: 'Inspection appointments',
      href: '/calendar',
      imageSrc: '/switch-icons/calendar.svg',
      icon: CalendarDays,
      accentColor: '#3b82f6',
    },
    {
      title: 'Employee Roster',
      subtitle: 'Security pins & access',
      href: '/employees',
      imageSrc: '/switch-icons/employees.svg',
      icon: Users,
      accentColor: '#ec4899',
    },
    {
      title: 'Reports & Analytics',
      subtitle: 'PDF exports & KPI data',
      href: '/reports',
      imageSrc: '/switch-icons/reports.svg',
      icon: BarChart3,
      accentColor: '#6366f1',
    },
    {
      title: 'System Settings',
      subtitle: 'Form setup & database',
      href: '/settings',
      imageSrc: '/switch-icons/settings.svg',
      icon: Settings,
      accentColor: '#64748b',
    },
  ];

  return (
    <div className="switch-viewport select-none">
      {/* 1. TOP ROW: Profile Avatar & Status Icons */}
      <div className="flex items-center justify-between h-[8vh] px-4 sm:px-8">
        <button
          type="button"
          onClick={() => {
            playSwitchSound('user');
            onProfileClick();
          }}
          className="flex items-center gap-3.5 group focus:outline-none"
        >
          <div className="w-13 h-13 rounded-full border-[3px] border-[#504F4E] group-hover:border-[#3db4ad] group-hover:scale-105 transition-all overflow-hidden bg-[#0885a5] shadow-sm flex items-center justify-center text-white font-bold text-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.name?.[0]?.toUpperCase() || 'M'
            )}
          </div>
          <span className="text-xl font-medium text-[#333] group-hover:text-[#0885a5] transition-colors">
            {user?.name || 'Manager'}
          </span>
        </button>

        <div className="flex items-center gap-4 text-xl font-medium text-[#444]">
          <span>{timeStr}</span>
          <Wifi className="w-5 h-5 text-[#444]" />
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold">100%</span>
            <BatteryMedium className="w-6 h-6 text-[#444]" />
          </div>
        </div>
      </div>

      {/* 2. ACTIVE APP TITLE */}
      <div className="text-center h-[6vh] flex items-center justify-center">
        <span className="text-2xl font-semibold text-[#0885a5] tracking-wide">
          {activeTitle}
        </span>
      </div>

      {/* 3. CENTER CAROUSEL (Game Cards) - Centered with safe side padding to eliminate left clipping */}
      <div className="w-full flex items-center gap-6 overflow-x-auto py-8 px-12 sm:px-24 snap-x snap-mandatory scroll-px-12 sm:scroll-px-24 scrollbar-thin">
        {apps.map((app) => {
          const Icon = app.icon;
          const isSelected = activeTitle === app.title;
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
              className={`switch-glow relative shrink-0 w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-[#ffffff] border-[3.5px] p-5 flex flex-col justify-between text-center cursor-pointer shadow-md snap-center ${
                isSelected ? 'is-selected border-[#62EFDF]' : 'border-[#f0f0f0]'
              }`}
            >
              {app.badge !== undefined && (
                <span className="absolute top-3 right-3 min-w-6 h-6 px-1.5 rounded-full bg-[#ff4554] text-white text-xs font-black flex items-center justify-center border-2 border-white shadow-sm">
                  {app.badge}
                </span>
              )}

              <div className="flex items-center justify-center flex-1 my-1">
                {app.imageSrc ? (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-md group-hover:scale-105 transition-transform duration-150">
                    <img
                      src={app.imageSrc}
                      alt={app.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${app.accentColor}18`, color: app.accentColor }}
                  >
                    <Icon className="w-10 h-10 stroke-[2.2]" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#222] truncate">
                  {app.title}
                </h3>
                <p className="text-xs text-[#777] font-medium mt-0.5 truncate">
                  {app.subtitle}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 4. CIRCULAR OPTION BUTTONS & JOY-CON LEGEND */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-[12vh] px-6 sm:px-12 pt-2">
        {/* Switch Action Tray */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* News / Alerts */}
          <button
            type="button"
            onClick={() => {
              playSwitchSound('news');
              router.push('/pending');
            }}
            className="switch-circle-btn group"
            title="News & Pending Alerts"
          >
            <Bell className="w-6 h-6 text-[#ff4554] group-hover:scale-110 transition-transform" />
            {pendingAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ff4554] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {pendingAlerts}
              </span>
            )}
          </button>

          {/* eShop / QR Scan */}
          <button
            type="button"
            onClick={() => {
              playSwitchSound('popup');
              onScanClick();
            }}
            className="switch-circle-btn group !bg-[#ffa524] !border-[#ffa524]"
            title="Scan QR Code"
          >
            <QrCode className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </button>

          {/* Album / Inspections */}
          <button
            type="button"
            onClick={() => {
              playSwitchSound('popup');
              router.push('/inspections');
            }}
            className="switch-circle-btn group"
            title="Completed Inspection Records"
          >
            <ClipboardCheck className="w-6 h-6 text-[#10b981] group-hover:scale-110 transition-transform" />
          </button>

          {/* Fleet Vehicles */}
          <button
            type="button"
            onClick={() => {
              playSwitchSound('popup');
              router.push('/vehicles');
            }}
            className="switch-circle-btn group"
            title="Fleet Vehicles & Status"
          >
            <Truck className="w-6 h-6 text-[#0284c7] group-hover:scale-110 transition-transform" />
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => {
              playSwitchSound('popup');
              router.push('/settings');
            }}
            className="switch-circle-btn group"
            title="System Settings"
          >
            <Settings className="w-6 h-6 text-[#444] group-hover:scale-110 transition-transform" />
          </button>

          {/* Sleep / Logout */}
          <button
            type="button"
            onClick={() => {
              playSwitchSound('klick');
              logout();
            }}
            className="switch-circle-btn group"
            title="Sleep Console / Logout"
          >
            <Power className="w-6 h-6 text-[#888] group-hover:text-[#ff4554] group-hover:scale-110 transition-all" />
          </button>
        </div>

        {/* Joy-Con Controller Legend */}
        <div className="flex items-center gap-5 text-sm font-bold text-[#666]">
          <div className="flex items-center gap-1.5">
            <span className="switch-glyph-btn text-[#00c3e3] border-[#00c3e3]">A</span>
            <span>Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="switch-glyph-btn text-[#ff4554] border-[#ff4554]">B</span>
            <span>Back</span>
          </div>
        </div>
      </div>
    </div>
  );
}
