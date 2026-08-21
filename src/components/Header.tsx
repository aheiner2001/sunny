'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Bell, 
  ChevronDown, 
  Menu, 
  QrCode, 
  UserCheck, 
  Shield, 
  User as UserIcon,
  Sparkles,
  ExternalLink,
  Camera,
  Settings,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { dbService } from '@/lib/db';
import { ProfileModal } from '@/components/ProfileModal';
import { getResolvedAvatarUrl } from '@/lib/avatarPresets';
import { asset } from '@/lib/basePath';

export function Header({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { user, role, switchUser, availableUsers, canSwitchUser, logout, managerGrantUntil } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentAvatarUrl = getResolvedAvatarUrl(user);

  useEffect(() => {
    const loadNotifications = () => setIssues(dbService.getIssues().filter(issue => issue.status !== 'fixed'));
    loadNotifications();
    window.addEventListener('sunny_db_update', loadNotifications);
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setNotifMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('sunny_db_update', loadNotifications);
    };
  }, []);

  return (
    <header className="h-18 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 overflow-hidden">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {/* Brand mark. Mobile only: the sidebar (and its logo) is hidden below lg. */}
        <img
          src={asset('/sunny-logo.png')}
          alt="Sunny logo"
          className="lg:hidden h-9 w-28 shrink-0 object-contain object-left"
        />
        <div className="min-w-0 hidden lg:block">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">Dashboard</h1>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0" ref={menuRef}>
        {/* Notification Bell */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setNotifMenuOpen(!notifMenuOpen);
              setUserMenuOpen(false);
            }}
            className="relative p-2.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {issues.length > 0 && <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shadow-sm">{issues.length}</span>}
          </button>

          {notifMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-2">
                <span className="font-bold text-slate-900 text-sm">Notifications</span>
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">{issues.length} unread</span>
              </div>
              <div className="space-y-2">
                {issues.slice(0, 5).map(issue => <Link
                  key={issue.id}
                  href={`/issues?issue=${encodeURIComponent(issue.id)}`}
                  onClick={() => setNotifMenuOpen(false)}
                  className="block p-2 rounded-xl bg-amber-50/70 border border-amber-100 text-xs hover:bg-amber-100/70 transition-colors"
                >
                  <div className="font-semibold text-slate-800">Issue Reported: {issue.vehicleNumber}</div>
                  <div className="text-slate-600">{issue.title || issue.equipmentName}</div>
                  <div className="text-[10px] text-amber-700 font-medium mt-1">{new Date(issue.reportedAt).toLocaleString()}</div>
                </Link>)}
                {issues.length === 0 && <p className="p-2 text-xs text-slate-400">No unread notifications.</p>}
              </div>
            </div>
          )}
        </div>

        {/* User profile with Role Switcher & Customize Profile */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotifMenuOpen(false);
            }}
            className="flex items-center gap-2 sm:gap-3 p-1.5 sm:pr-3 rounded-full hover:bg-slate-100/80 transition-colors border border-transparent hover:border-slate-200 max-w-[220px]"
          >
            {user ? (
              <img
                src={currentAvatarUrl}
                alt={user.name || 'User'}
                className={`w-9 h-9 shrink-0 object-cover ring-2 ring-sky-500/20 shadow-sm ${
                  user.avatarStyle === 'circle' || !user.avatarStyle ? 'rounded-full' : user.avatarStyle === 'square' ? 'rounded-none' : 'rounded-xl'
                }`}
              />
            ) : (
              <div className="w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center ring-2 ring-sky-500/20 shadow-sm">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-sm font-bold text-slate-900 leading-tight truncate">
                {user?.name}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 capitalize truncate">
                {managerGrantUntil ? (
                  <span className="text-sky-600 font-bold normal-case">Admin (temporary)</span>
                ) : (
                  user?.role
                )}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 hidden sm:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Account</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  {managerGrantUntil && (
                    <p className="text-[11px] font-bold text-sky-700 mt-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Admin access until {new Date(managerGrantUntil).toLocaleString([], {
                        weekday: 'short',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Profile Photo Customization Button */}
              <div className="p-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-slate-700 hover:bg-slate-100 font-semibold transition-colors"
                >
                  <Camera className="w-4 h-4 text-sky-600" />
                  <span>Customize Photo & Profile</span>
                </button>
              </div>

              {/* Managers switch accounts freely; employees sign out instead. */}
              {canSwitchUser && <div className="py-2 border-t border-slate-100">
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Switch Account (RBAC)
                </p>
                <div className="space-y-1">
                  {availableUsers.map((u) => {
                    const isSelected = u.id === user?.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setUserMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-sky-50 text-sky-700 font-bold'
                            : 'hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className={`w-6 h-6 object-cover ring-1 ring-slate-200 ${
                              u.avatarStyle === 'circle' || !u.avatarStyle ? 'rounded-full' : u.avatarStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                            }`}
                          />
                        ) : (
                          <img
                            src={getResolvedAvatarUrl(u)}
                            alt={`${u.name} default avatar`}
                            className={`w-6 h-6 object-cover ring-1 ring-slate-200 ${
                              u.avatarStyle === 'circle' || !u.avatarStyle ? 'rounded-full' : u.avatarStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                            }`}
                          />
                        )}
                        <div className="flex-1 truncate">
                          <span className="block truncate">{u.name}</span>
                          <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                        </div>
                        {u.role === 'manager' ? (
                          <Shield className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>}

              <div className="pt-2 border-t border-slate-100 space-y-1">
                <Link
                  href="/scan"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-sky-700 hover:bg-sky-50"
                >
                  <QrCode className="w-4 h-4 text-sky-600" />
                  <span>Open Inspection Scanner</span>
                </Link>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </header>
  );
}
