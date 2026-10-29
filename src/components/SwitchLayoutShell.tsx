'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SwitchTopBar } from '@/components/SwitchTopBar';
import { SwitchFooter } from '@/components/SwitchFooter';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { QRScannerModal } from '@/components/QRScannerModal';
import { ProfileModal } from '@/components/ProfileModal';
import { QrCode, X } from 'lucide-react';
import { dbService } from '@/lib/db';

export function SwitchLayoutShell({ children }: { children: React.ReactNode }) {
  const { role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (role !== 'manager') return;
    const refresh = () => {
      try {
        const count = dbService.getInspectionAlerts().filter(a => a.status === 'pending').length;
        setPendingCount(count);
      } catch {
        // Safe fallback
      }
    };
    refresh();
    window.addEventListener('sunny_db_update', refresh);
    return () => window.removeEventListener('sunny_db_update', refresh);
  }, [role]);

  // If user is a manager, present the authentic Nintendo Switch OS Shell
  if (role === 'manager') {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#ebebeb] text-[#2c2c2c] overflow-hidden select-none">
        {/* Switch Top Bar (Profile, Clock, Battery, WiFi) */}
        <SwitchTopBar onProfileClick={() => setProfileModalOpen(true)} />

        {/* Central Viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-8 py-4 sm:py-6">
          <main id="main-content" className="w-full max-w-[1400px] mx-auto">
            {children}
          </main>
        </div>

        {/* Switch Bottom Action Tray */}
        <SwitchFooter
          onScanClick={() => setScannerOpen(true)}
          onLogoutClick={logout}
          pendingCount={pendingCount}
        />

        {/* Global Modals */}
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
        />
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
        />
      </div>
    );
  }

  // Employee Mode: Original reliable workflow
  return (
    <div className="flex h-full min-h-0">
      <div className="hidden lg:flex h-full shrink-0">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="sunny-mobile-drawer relative bg-surface w-72 h-full shadow-lg flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-full text-ink-muted hover:bg-surface-sunk"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div onClick={() => setMobileMenuOpen(false)}>
              <Sidebar />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <main id="main-content" className="w-full max-w-[1400px] mx-auto px-[var(--gutter)] py-4 sm:py-8 pb-24 lg:pb-8">
            {children}
          </main>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setScannerOpen(true)}
        className="btn btn-primary flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg lg:hidden fixed bottom-6 right-6 z-40"
      >
        <QrCode className="w-5 h-5" aria-hidden />
        <span>Scan QR</span>
      </button>

      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
