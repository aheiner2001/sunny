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
  RotateCcw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { dbService } from '@/lib/db';

export function Header({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { user, role, switchUser, availableUsers } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setNotifMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-18 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-4">
        {onMobileMenuToggle && (
          <button 
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4" ref={menuRef}>
        {/* Mobile quick scan button */}
        <Link
          href="/scan"
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-medium text-xs shadow-sm hover:bg-sky-700"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan</span>
        </Link>

        {/* Reset / Demo seed button */}
        <button
          onClick={() => {
            if (confirm('Reset fleet data to default initial state?')) {
              dbService.resetToDefaults();
              window.location.reload();
            }
          }}
          title="Reset fleet database to original demo state"
          className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifMenuOpen(!notifMenuOpen);
              setUserMenuOpen(false);
            }}
            className="relative p-2.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shadow-sm">
              3
            </span>
          </button>

          {notifMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-2">
                <span className="font-bold text-slate-900 text-sm">Notifications</span>
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">3 unread</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100 text-xs">
                  <div className="font-semibold text-slate-800">Issue Reported: Van #2</div>
                  <div className="text-slate-600">Sarah Johnson flagged Vacuum Hose tear.</div>
                  <div className="text-[10px] text-amber-700 font-medium mt-1">7:58 AM Today</div>
                </div>
                <div className="p-2 rounded-xl bg-sky-50/70 border border-sky-100 text-xs">
                  <div className="font-semibold text-slate-800">Inspection Passed: Van #3</div>
                  <div className="text-slate-600">John Smith submitted standard inspection.</div>
                  <div className="text-[10px] text-sky-700 font-medium mt-1">8:42 AM Today</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="font-semibold text-slate-800">Maintenance Update: Van #5</div>
                  <div className="text-slate-600">Window Squeegee moved to In Repair.</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Aug 17</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User profile with Role Switcher dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotifMenuOpen(false);
            }}
            className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-slate-100/80 transition-colors border border-transparent hover:border-slate-200"
          >
            <img
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={user?.name || 'User'}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-sky-500/20"
            />
            <div className="hidden sm:block text-left">
              <div className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                {user?.name}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 capitalize">
                {user?.role}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Account</p>
                <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>

              <div className="py-2">
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Switch Demo Account (RBAC)
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
                        <img
                          src={u.avatarUrl}
                          alt={u.name}
                          className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
                        />
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
              </div>

              <div className="pt-2 border-t border-slate-100">
                <Link
                  href="/scan"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-sky-700 hover:bg-sky-50"
                >
                  <QrCode className="w-4 h-4 text-sky-600" />
                  <span>Open Inspection Scanner</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
