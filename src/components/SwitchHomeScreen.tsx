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
  CalendarDays,
  Users,
  BarChart3,
  Settings,
  QrCode,
  Power,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard
} from 'lucide-react';
import { playSwitchSound } from '@/lib/switchAudio';
import { dbService } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { getResolvedAvatarUrl } from '@/lib/avatarPresets';

interface SwitchAppTile {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ElementType;
  iconColor: string;
  badge?: number | string;
}

export function SwitchHomeScreen({
  onScanClick,
  onProfileClick,
  onSwitchModeToggle
}: {
  onScanClick: () => void;
  onProfileClick: () => void;
  onSwitchModeToggle?: () => void;
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

  // Matching Books App Nintendo Switch Carousel:
  const apps: SwitchAppTile[] = [
    {
      title: 'Inspections Log',
      subtitle: 'Completed Audits',
      href: '/inspections',
      icon: ClipboardCheck,
      iconColor: '#10b981',
    },
    {
      title: 'Timesheets',
      subtitle: 'Clock Hours & Edits',
      href: '/timesheets',
      icon: Clock,
      iconColor: '#00c3e3',
    },
    {
      title: 'Vehicles & Fleet',
      subtitle: `${activeVehicles} Active Vans`,
      href: '/vehicles',
      icon: Truck,
      iconColor: '#0284c7',
      badge: activeVehicles > 0 ? activeVehicles : undefined,
    },
    {
      title: 'Pending Alerts',
      subtitle: 'Manager Approvals',
      href: '/pending',
      icon: Bell,
      iconColor: '#ff4554',
      badge: pendingAlerts > 0 ? pendingAlerts : undefined,
    },
    {
      title: 'Training & Skills',
      subtitle: 'Modules & Records',
      href: '/training',
      icon: GraduationCap,
      iconColor: '#f59e0b',
    },
    {
      title: 'Equipment & Supplies',
      subtitle: 'Tools & Lifespans',
      href: '/equipment',
      icon: Wrench,
      iconColor: '#8b5cf6',
    },
    {
      title: 'Issues & Repairs',
      subtitle: 'Maintenance Tickets',
      href: '/issues',
      icon: AlertTriangle,
      iconColor: '#f97316',
      badge: openIssues > 0 ? openIssues : undefined,
    },
    {
      title: 'Calendar Schedule',
      subtitle: 'Fleet Appointments',
      href: '/calendar',
      icon: CalendarDays,
      iconColor: '#3b82f6',
    },
    {
      title: 'Employee Roster',
      subtitle: 'Staff & Security Pins',
      href: '/employees',
      icon: Users,
      iconColor: '#ec4899',
    },
    {
      title: 'Reports & Analytics',
      subtitle: 'PDF & Data Exports',
      href: '/reports',
      icon: BarChart3,
      iconColor: '#6366f1',
    },
    {
      title: 'System Settings',
      subtitle: 'Database & Sound Options',
      href: '/settings',
      icon: Settings,
      iconColor: '#64748b',
    },
  ];

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = document.getElementById('switch-home-carousel');
    if (el) {
      el.scrollBy({ left: direction === 'left' ? -280 : 280, behavior: 'smooth' });
      playSwitchSound('klick', 0.2);
    }
  };

  return (
    <div className="switch-viewport select-none">
      {/* 1. TOP ROW: Profile Avatar & Status Tray */}
      <header className="switch-top-row">
        <button
          type="button"
          onClick={() => {
            playSwitchSound('user');
            onProfileClick();
          }}
          className="switch-profiles focus:outline-none"
        >
          <div className="switch-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" />
            ) : (
              <div className="w-full h-full bg-[#0885a5] text-white flex items-center justify-center font-bold text-lg">
                {user?.name?.[0]?.toUpperCase() || 'M'}
              </div>
            )}
          </div>
          <span className="switch-profile-name">
            {user?.name || 'Manager'}
          </span>
        </button>

        <div className="switch-status-tray flex items-center gap-3">
          {onSwitchModeToggle && (
            <button
              type="button"
              onClick={() => {
                onSwitchModeToggle();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300 hover:border-slate-500 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
              title="Switch back to Classic Sunny Fleet UI"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Classic UI</span>
            </button>
          )}
          <span>{timeStr}</span>
          <span className="text-xs uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]">
            Sunny Fleet OS
          </span>
        </div>
      </header>

      {/* 2. ACTIVE SELECTION TITLE BANNER */}
      <div className="switch-active-title-wrap">
        <h2 className="switch-active-title">
          {activeTitle}
        </h2>
      </div>

      {/* 3. CENTER CAROUSEL (Nintendo Switch Cards) */}
      <div className="relative w-full flex items-center justify-center">
        {/* Carousel Nav Arrows */}
        <button
          type="button"
          onClick={() => scrollCarousel('left')}
          className="hidden md:flex absolute left-2 z-30 w-10 h-10 rounded-full bg-white border border-[#dadada] shadow-md items-center justify-center text-[#555] hover:text-[#0885a5] hover:border-[#0885a5] hover:scale-110 transition-all"
          title="Scroll Left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div
          id="switch-home-carousel"
          className="switch-carousel-container snap-x snap-mandatory scroll-smooth"
        >
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
                className={`switch-card snap-center ${
                  isSelected ? 'is-selected' : ''
                }`}
              >
                {/* Badge for Pending/Issues/Vehicles */}
                {app.badge !== undefined && (
                  <span className="card-badge" style={{ display: 'block' }}>
                    {app.badge}
                  </span>
                )}

                {/* Nintendo Switch Icon */}
                <div
                  className="card-icon"
                  style={{ color: app.iconColor }}
                >
                  <Icon className="w-16 h-16 sm:w-20 sm:h-20 stroke-[1.8] transition-transform duration-150" />
                </div>

                {/* Card Title & Subtitle */}
                <h3 className="card-title truncate w-full px-2">
                  {app.title}
                </h3>
                <p className="card-subtitle truncate w-full px-2">
                  {app.subtitle}
                </p>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollCarousel('right')}
          className="hidden md:flex absolute right-2 z-30 w-10 h-10 rounded-full bg-white border border-[#dadada] shadow-md items-center justify-center text-[#555] hover:text-[#0885a5] hover:border-[#0885a5] hover:scale-110 transition-all"
          title="Scroll Right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* 4. CIRCULAR OPTION BUTTONS & ACTION TRAY */}
      <div className="switch-options-row">
        {/* Pending Alerts / News */}
        <button
          type="button"
          onClick={() => {
            playSwitchSound('news');
            router.push('/pending');
          }}
          className="switch-circle-btn group"
          title="News & Pending Alerts"
        >
          <Bell className="w-7 h-7 text-[#ff4554] group-hover:scale-110 transition-transform" />
          {pendingAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ff4554] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
              {pendingAlerts}
            </span>
          )}
        </button>

        {/* Scan QR */}
        <button
          type="button"
          onClick={() => {
            playSwitchSound('popup');
            onScanClick();
          }}
          className="switch-circle-btn group !bg-[#ffa524] !border-[#ffa524]"
          title="Scan QR Code"
        >
          <QrCode className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
        </button>

        {/* Inspections */}
        <button
          type="button"
          onClick={() => {
            playSwitchSound('popup');
            router.push('/inspections');
          }}
          className="switch-circle-btn group"
          title="Completed Inspections Log"
        >
          <ClipboardCheck className="w-7 h-7 text-[#10b981] group-hover:scale-110 transition-transform" />
        </button>

        {/* Vehicles */}
        <button
          type="button"
          onClick={() => {
            playSwitchSound('popup');
            router.push('/vehicles');
          }}
          className="switch-circle-btn group"
          title="Fleet Vehicles & Status"
        >
          <Truck className="w-7 h-7 text-[#0284c7] group-hover:scale-110 transition-transform" />
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
          <Settings className="w-7 h-7 text-[#444] group-hover:scale-110 transition-transform" />
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={() => {
            playSwitchSound('klick');
            logout();
          }}
          className="switch-circle-btn group"
          title="Lock Console / Sign Out"
        >
          <Power className="w-7 h-7 text-[#888] group-hover:text-[#ff4554] group-hover:scale-110 transition-all" />
        </button>
      </div>

      {/* 5. FOOTER: Status text */}
      <footer className="text-center py-2 text-xs font-semibold text-[#888]">
        Sunny Fleet Accountability &bull; Nintendo Switch OS Mode
      </footer>
    </div>
  );
}
