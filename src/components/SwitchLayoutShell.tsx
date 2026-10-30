'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SwitchHomeScreen } from '@/components/SwitchHomeScreen';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { QRScannerModal } from '@/components/QRScannerModal';
import { ProfileModal } from '@/components/ProfileModal';
import { QrCode, X, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { playSwitchSound } from '@/lib/switchAudio';
import { NAV_ITEMS } from '@/lib/navItems';
import { getPageTitle } from '@/lib/pageTitles';
import { useSwitchUiMode } from '@/lib/switchUiMode';

export function SwitchLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAuth();
  const [isSwitchMode, setSwitchMode] = useSwitchUiMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // If user is a manager AND Switch Mode is active
  if (role === 'manager' && isSwitchMode) {
    const isHomeScreen = pathname === '/dashboard' || pathname === '/';

    // 1. Full authentic Switch Home Screen (Pure White, Centered Carousel)
    if (isHomeScreen) {
      return (
        <div className="w-screen h-screen overflow-hidden bg-white">
          <SwitchHomeScreen
            onScanClick={() => setScannerOpen(true)}
            onProfileClick={() => setProfileModalOpen(true)}
            onSwitchModeToggle={() => setSwitchMode(false)}
          />

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

    // 2. Sub-Pages opened as a native Switch App with top (Home) return bar & active app badge
    const activeTitle = getPageTitle(pathname || '');
    const activeItem = NAV_ITEMS.find(item => item.label === activeTitle || (item.href !== '/dashboard' && pathname.startsWith(item.href)));
    const ActiveIcon = activeItem?.icon;

    return (
      <div className="flex flex-col w-screen h-screen overflow-hidden bg-white text-[#2c2c2c] select-none">
        {/* Switch App Header with Active App Grounding */}
        <header className="h-16 px-4 sm:px-8 bg-white border-b border-[#e5e5e5] flex items-center justify-between shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                playSwitchSound('home');
                router.push('/dashboard');
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 border-[#2d2d2d] bg-[#ffffff] hover:border-[#00c3e3] hover:scale-105 transition-all text-[#2d2d2d] font-bold text-sm shadow-sm"
              title="Return to Switch Home Carousel"
            >
              <ArrowLeft className="w-4 h-4 text-[#00c3e3]" />
              <span className="tracking-wide">Home</span>
            </button>

            <div className="h-5 w-px bg-[#e2e8f0] hidden sm:block" />

            <div className="flex items-center gap-2">
              {ActiveIcon && (
                <div className="w-8 h-8 rounded-lg bg-[#f0f9ff] border border-[#bae6fd] flex items-center justify-center text-[#0284c7]">
                  <ActiveIcon className="w-4 h-4" />
                </div>
              )}
              <span className="font-extrabold text-base sm:text-lg text-[#1e293b] tracking-tight">
                {activeTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setSwitchMode(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-slate-200 bg-white hover:border-slate-400 text-slate-700 text-xs font-bold transition-all shadow-sm"
              title="Return to Classic Fleet UI"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Classic UI</span>
            </button>
            <span className="hidden md:inline-block text-xs uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]">
              Sunny Fleet OS
            </span>
            <button
              type="button"
              onClick={() => {
                playSwitchSound('popup');
                setScannerOpen(true);
              }}
              className="p-2 rounded-full border border-[#d5d5d5] bg-white hover:border-[#ffa524] text-[#ffa524] shadow-sm transition-all"
              title="Scan QR"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* The original app content pane */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-white">
          <main id="main-content" className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-6 pb-20 bg-white">
            {children}
          </main>
        </div>

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

  // Employee Mode: Original workflow intact
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
