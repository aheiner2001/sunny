'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { INITIAL_USERS } from '@/lib/mockData';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  switchUser: (userId: string) => void;
  availableUsers: User[];
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(INITIAL_USERS[0]); // Default to Jacob Heiner (Manager)

  useEffect(() => {
    const savedUserId = localStorage.getItem('sunny_current_user_id');
    if (savedUserId) {
      const found = INITIAL_USERS.find(u => u.id === savedUserId);
      if (found) setUser(found);
    }
  }, []);

  const switchUser = (userId: string) => {
    const target = INITIAL_USERS.find(u => u.id === userId);
    if (target) {
      setUser(target);
      localStorage.setItem('sunny_current_user_id', target.id);
    }
  };

  const login = (email: string) => {
    const target = INITIAL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (target) {
      setUser(target);
      localStorage.setItem('sunny_current_user_id', target.id);
    }
  };

  const logout = () => {
    setUser(INITIAL_USERS[1]); // switch to John Smith for employee demo or clear
    localStorage.setItem('sunny_current_user_id', INITIAL_USERS[1].id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'employee',
        switchUser,
        availableUsers: INITIAL_USERS,
        login,
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
