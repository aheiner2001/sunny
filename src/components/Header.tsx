'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getPageTitle } from '@/lib/pageTitles';
import {
  Bell,
  ChevronDown,
  Menu,
  QrCode,
  Shield,
  User as UserIcon,
  Camera,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { dbService } from '@/lib/db';
import { ProfileModal } from '@/components/ProfileModal';
import { getResolvedAvatarUrl } from '@/lib/avatarPresets';
import { asset } from '@/lib/basePath';

export function Header({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname || '/dashboard');
  const { user, switchUser, availableUsers, canSwitchUser, logout, managerGrantUntil } = useAuth();
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
    <header className="h-18 bg-surface border-b border-line px-4 sm:px-8 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 overflow-hidden">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden shrink-0 p-2 rounded-lg text-ink-muted hover:bg-surface-sunk hover:text-ink"
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
        <div className="min-w-0 flex-1">
          <h1 className="page-title text-xl truncate">{pageTitle}</h1>
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
            className="relative p-2.5 rounded-full text-ink-muted hover:bg-surface-sunk hover:text-ink transition-colors"
            aria-label={issues.length > 0 ? `Notifications, ${issues.length} unread` : 'Notifications'}
          >
            <Bell className="w-5 h-5" />
            {/* The one place amber belongs in the chrome: something needs a human. */}
            {issues.length > 0 && <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-hivis text-ink font-mono font-medium text-[10px] flex items-center justify-center">{issues.length}</span>}
          </button>

          {notifMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-surface rounded-card shadow-panel border border-line p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-line px-2">
                <span className="font-display font-bold text-sm">Notifications</span>
                <span className="badge" data-status={issues.length > 0 ? 'flagged' : 'idle'}>{issues.length} unread</span>
              </div>
              <div className="space-y-2">
                {issues.slice(0, 5).map(issue => <Link
                  key={issue.id}
                  href={`/issues?issue=${encodeURIComponent(issue.id)}`}
                  onClick={() => setNotifMenuOpen(false)}
                  className="row rounded-lg border-b-0 text-xs"
                  data-status="flagged"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">Issue reported: {issue.vehicleNumber}</span>
                    <span className="block text-ink-muted truncate">{issue.title || issue.equipmentName}</span>
                    <time className="unit-tag block mt-1">{new Date(issue.reportedAt).toLocaleString()}</time>
                  </span>
                </Link>)}
                {issues.length === 0 && <p className="p-2 text-xs text-ink-faint">Nothing unread. New issues appear here as crews report them.</p>}
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
            className="flex items-center gap-2 sm:gap-3 p-1.5 sm:pr-3 rounded-full hover:bg-surface-sunk transition-colors border border-transparent hover:border-line max-w-[220px]"
          >
            {user ? (
              <img
                src={currentAvatarUrl}
                alt={user.name || 'User'}
                className={`w-9 h-9 shrink-0 object-cover ring-1 ring-line-strong ${
                  user.avatarStyle === 'circle' || !user.avatarStyle ? 'rounded-full' : user.avatarStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                }`}
              />
            ) : (
              <div className="w-9 h-9 shrink-0 rounded-full bg-surface-sunk text-ink-faint flex items-center justify-center ring-1 ring-line-strong">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-sm font-display font-semibold leading-tight truncate">
                {user?.name}
              </div>
              <div className="text-2xs font-medium text-ink-faint capitalize truncate">
                {managerGrantUntil ? (
                  <span className="text-ink font-semibold normal-case">Admin (temporary)</span>
                ) : (
                  user?.role
                )}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 shrink-0 text-ink-faint hidden sm:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-surface rounded-card shadow-panel border border-line p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-line flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow mb-1">Active account</p>
                  <p className="text-sm font-display font-semibold truncate">{user?.name}</p>
                  {user?.email && <p className="text-xs text-ink-muted truncate">{user?.email}</p>}
                  {managerGrantUntil && (
                    <p className="text-2xs font-semibold text-ink mt-1 flex items-center gap-1">
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-ink hover:bg-surface-sunk font-semibold transition-colors"
                >
                  <Camera className="w-4 h-4 text-ink-muted" />
                  <span>Customize photo</span>
                </button>
              </div>

              {/* Managers switch accounts freely; employees sign out instead. */}
              {canSwitchUser && <div className="py-2 border-t border-line">
                <p className="eyebrow px-3 mb-1">Switch account</p>
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
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-surface-sunk text-ink font-semibold'
                            : 'hover:bg-surface-alt text-ink-muted font-medium'
                        }`}
                      >
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className={`w-6 h-6 object-cover ring-1 ring-line ${
                              u.avatarStyle === 'circle' || !u.avatarStyle ? 'rounded-full' : u.avatarStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                            }`}
                          />
                        ) : (
                          <img
                            src={getResolvedAvatarUrl(u)}
                            alt={`${u.name} default avatar`}
                            className={`w-6 h-6 object-cover ring-1 ring-line ${
                              u.avatarStyle === 'circle' || !u.avatarStyle ? 'rounded-full' : u.avatarStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                            }`}
                          />
                        )}
                        <div className="flex-1 truncate">
                          <span className="block truncate">{u.name}</span>
                          <span className="unit-tag capitalize">{u.role}</span>
                        </div>
                        {u.role === 'manager' ? (
                          <Shield className="w-3.5 h-3.5 text-ink" />
                        ) : (
                          <UserIcon className="w-3.5 h-3.5 text-ink-faint" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>}

              <div className="pt-2 border-t border-line space-y-1">
                <Link
                  href="/scan"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-ink hover:bg-surface-sunk"
                >
                  <QrCode className="w-4 h-4 text-ink-muted" />
                  <span>Open inspection scanner</span>
                </Link>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-critical hover:bg-critical-wash transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
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
