'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * URL-level guard for manager pages. Hiding a route from the sidebar does not
 * stop an employee typing the path, so every manager page wraps its content.
 *
 * Honours temporary grants: `role` from useAuth is the effective role. Pass
 * `requireTrueManager` for account control that a day-admin must never reach.
 */
export function ManagerOnly({
  children,
  requireTrueManager = false,
  title = 'Managers only',
  message = 'This area is restricted to manager accounts. Ask a manager if you need access.'
}: {
  children: React.ReactNode;
  requireTrueManager?: boolean;
  title?: string;
  message?: string;
}) {
  const { role, isTrueManager, hydrated } = useAuth();

  if (!hydrated) return null;

  const allowed = requireTrueManager ? isTrueManager : role === 'manager';
  if (allowed) return <>{children}</>;

  return (
    <div className="card card-pad max-w-md mx-auto mt-12 text-center">
      <div className="icon-tile mx-auto mb-3 text-ink-muted">
        <Lock className="w-6 h-6" aria-hidden />
      </div>
      <h1 className="text-lg font-extrabold text-ink">{title}</h1>
      <p className="text-xs text-ink-muted mt-1">{message}</p>
    </div>
  );
}
