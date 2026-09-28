'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { asset } from '@/lib/basePath';
import { NAV_ITEMS } from '@/lib/navItems';
import { dbService } from '@/lib/db';

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (role !== 'manager') { setPendingCount(0); return; }
    const refresh = () => setPendingCount(dbService.getInspectionAlerts().filter(alert => alert.status === 'pending').length);
    refresh();
    window.addEventListener('sunny_db_update', refresh);
    return () => window.removeEventListener('sunny_db_update', refresh);
  }, [role]);

  return (
    <aside className="sunny-sidebar w-64 h-full bg-surface border-r border-line flex flex-col shrink-0 select-none z-30 overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-line">
          <img
            src={asset('/sunny-logo.png')}
            alt="Sunny logo"
            className="h-12 w-36 object-cover object-center"
          />
        </div>

        {/* Nav links */}
        <nav className="p-4 space-y-1.5">
          {NAV_ITEMS.filter(item => {
            if (item.managerOnly && role !== 'manager') return false;
            if (item.employeeOnly && role === 'manager') return false;
            return true;
          }).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.href === '/pending' && pendingCount > 0 ? `Pending, ${pendingCount} awaiting review` : undefined}
                className={`relative flex items-center gap-3.5 px-4 py-2.5 rounded-lg font-display text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-surface-sunk text-ink font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-ink'
                    : 'text-ink-muted font-medium hover:bg-surface-alt hover:text-ink'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-ink' : 'text-ink-faint'}`} />
                {item.label}
                {item.href === '/pending' && pendingCount > 0 && (
                  <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold tabular-nums flex items-center justify-center" aria-hidden="true">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

    </aside>
  );
}
