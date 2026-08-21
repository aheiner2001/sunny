'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, AuthSession } from '@/types';
import { dbService } from '@/lib/db';

interface AuthContextType {
  user: User | null;
  /**
   * Effective permission role: the account's own role, or 'manager' while a
   * temporary grant is active. Gate normal manager features on this.
   */
  role: UserRole;
  /**
   * True only for a real manager account. Gate account control on this —
   * user management, other people's passcodes, granting admin, factory reset —
   * so a temporary admin cannot escalate or perpetuate its own access.
   */
  isTrueManager: boolean;
  /** Expiry of an active temporary grant, else null. */
  managerGrantUntil: string | null;
  session: AuthSession | null;
  /** False until localStorage has been read, so the lock screen never flashes. */
  hydrated: boolean;
  isAuthenticated: boolean;
  /** Managers may switch accounts without re-entering a code; employees may not. */
  canSwitchUser: boolean;
  switchUser: (userId: string) => void;
  updateProfile: (updatedData: Partial<User>) => Promise<User>;
  availableUsers: User[];
  loginWithPasscode: (passcode: string) => { success: boolean; error?: string };
  /** Live session check for guarding a navigation, bypassing stale render state. */
  isSessionValid: () => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Bumped when a temporary grant lapses, to recompute the effective role.
  const [grantTick, setGrantTick] = useState(0);

  const syncFromSession = useCallback(() => {
    const list = dbService.getUsers();
    setUsers(list);

    const activeSession = dbService.getSession();
    if (!activeSession) {
      setSession(null);
      setUser(null);
      return;
    }

    const owner = list.find(u => u.id === activeSession.userId) || null;
    setSession(owner ? activeSession : null);
    setUser(owner);
  }, []);

  useEffect(() => {
    syncFromSession();
    setHydrated(true);
    window.addEventListener('sunny_db_update', syncFromSession);
    return () => window.removeEventListener('sunny_db_update', syncFromSession);
  }, [syncFromSession]);

  const grantActive = dbService.hasActiveManagerGrant(user);
  const effectiveRole: UserRole = user?.role === 'manager' ? 'manager' : grantActive ? 'manager' : 'employee';

  // Drop elevation the moment the grant lapses, without waiting for a reload.
  useEffect(() => {
    if (!user?.tempManagerUntil) return;
    const remaining = new Date(user.tempManagerUntil).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setGrantTick(t => t + 1), remaining + 500);
    return () => clearTimeout(timer);
  }, [user?.tempManagerUntil, grantTick]);

  const loginWithPasscode = (passcode: string): { success: boolean; error?: string } => {
    const code = (passcode || '').trim();
    if (!code) return { success: false, error: 'Enter your passcode to continue.' };

    const target = dbService.getUserByPasscode(code);
    if (!target) return { success: false, error: 'That passcode was not recognized.' };

    const newSession = dbService.createSession(target);
    localStorage.setItem('sunny_current_user_id', target.id);
    setSession(newSession);
    setUser(target);
    setUsers(dbService.getUsers());
    return { success: true };
  };

  const isSessionValid = useCallback(() => dbService.getSession() !== null, []);

  const switchUser = (userId: string) => {
    // Only managers switch freely; everyone else signs out and back in.
    if (user?.role !== 'manager') return;

    const target = dbService.getUsers().find(u => u.id === userId);
    if (!target) return;

    const newSession = dbService.createSession(target);
    localStorage.setItem('sunny_current_user_id', target.id);
    setSession(newSession);
    setUser(target);
  };

  const updateProfile = async (updatedData: Partial<User>): Promise<User> => {
    if (!user) throw new Error('No user signed in');
    const updatedUser: User = {
      ...user,
      ...updatedData
    };
    const result = await dbService.updateUser(updatedUser);
    setUser(result);
    return result;
  };

  const logout = () => {
    dbService.clearSession();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: effectiveRole,
        isTrueManager: user?.role === 'manager',
        managerGrantUntil: grantActive ? user?.tempManagerUntil || null : null,
        session,
        hydrated,
        isAuthenticated: Boolean(session && user),
        // Tied to the true role: a day-admin must not be able to switch into a
        // permanent manager account and keep the access.
        canSwitchUser: user?.role === 'manager',
        switchUser,
        updateProfile,
        availableUsers: users,
        loginWithPasscode,
        isSessionValid,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
