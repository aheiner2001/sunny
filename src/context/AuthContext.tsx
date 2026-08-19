'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { dbService } from '@/lib/db';

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
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [user, setUser] = useState<User | null>(INITIAL_USERS[0]); // Default to Jacob Heiner (Manager)

  const refreshUsers = () => {
    const list = dbService.getUsers();
    setUsers(list);
    
    const savedUserId = localStorage.getItem('sunny_current_user_id');
    if (savedUserId) {
      const found = list.find(u => u.id === savedUserId);
      if (found) {
        setUser(found);
        return;
      }
    }

    // Default or fallback
    if (list.length > 0) {
      setUser(prev => {
        if (!prev) return list[0];
        const stillExists = list.find(u => u.id === prev.id);
        return stillExists || list[0];
      });
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUsers();
    window.addEventListener('sunny_db_update', refreshUsers);
    return () => window.removeEventListener('sunny_db_update', refreshUsers);
  }, []);

  const switchUser = (userId: string) => {
    const list = dbService.getUsers();
    const target = list.find(u => u.id === userId);
    if (target) {
      setUser(target);
      localStorage.setItem('sunny_current_user_id', target.id);
    }
  };

  const login = (email: string) => {
    const list = dbService.getUsers();
    const target = list.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (target) {
      setUser(target);
      localStorage.setItem('sunny_current_user_id', target.id);
    }
  };

  const logout = () => {
    const list = dbService.getUsers();
    const employee = list.find(u => u.role === 'employee') || list[0];
    if (employee) {
      setUser(employee);
      localStorage.setItem('sunny_current_user_id', employee.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'employee',
        switchUser,
        availableUsers: users,
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
