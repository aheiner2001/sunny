'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  QrCode,
  Image,
  Gamepad2,
  Settings,
  Power,
  RotateCcw
} from 'lucide-react';
import { playSwitchSound } from '@/lib/switchAudio';

interface SwitchFooterProps {
  onScanClick: () => void;
  onLogoutClick?: () => void;
  pendingCount?: number;
}

export function SwitchFooter({ onScanClick, onLogoutClick, pendingCount = 0 }: SwitchFooterProps) {
  const router = useRouter();

  const handleNav = (path: string, sound: 'klick' | 'popup' | 'news' = 'popup') => {
    playSwitchSound(sound);
    router.push(path);
  };

  return (
    <footer className="w-full bg-[#ebebeb] border-t border-[#dadada] px-6 py-4 flex flex-wrap items-center justify-between gap-4 select-none shrink-0 z-20">
      {/* Authentic Switch Circular Icon Action Tray */}
      <div className="flex items-center gap-3.5 sm:gap-5">
        {/* News / Pending Alerts */}
        <button
          type="button"
          onClick={() => handleNav('/pending', 'news')}
          className="relative group flex flex-col items-center gap-1 focus:outline-none"
          title="Nintendo News / Pending Inspection Alerts"
        >
          <div className="w-12 h-12 rounded-full bg-white border-2 border-[#d0d0d0] text-[#ff4554] flex items-center justify-center shadow-sm group-hover:border-[#ff4554] group-hover:scale-110 transition-all">
            <Bell className="w-5 h-5 fill-current" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ff4554] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-[#666] group-hover:text-[#222]">Alerts</span>
        </button>

        {/* Nintendo eShop / QR Scan */}
        <button
          type="button"
          onClick={() => {
            playSwitchSound('popup');
            onScanClick();
          }}
          className="group flex flex-col items-center gap-1 focus:outline-none"
          title="Scan QR Vehicle / Equipment Code"
        >
          <div className="w-12 h-12 rounded-full bg-[#ffa524] border-2 border-[#ffa524] text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-all">
            <QrCode className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-[#666] group-hover:text-[#222]">Scan QR</span>
        </button>

        {/* Album / Inspections Gallery */}
        <button
          type="button"
          onClick={() => handleNav('/inspections')}
          className="group flex flex-col items-center gap-1 focus:outline-none"
          title="Completed Inspections Log"
        >
          <div className="w-12 h-12 rounded-full bg-white border-2 border-[#d0d0d0] text-[#00c3e3] flex items-center justify-center shadow-sm group-hover:border-[#00c3e3] group-hover:scale-110 transition-all">
            <Image className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-[#666] group-hover:text-[#222]">Logs</span>
        </button>

        {/* Controllers / Fleet Vehicles */}
        <button
          type="button"
          onClick={() => handleNav('/vehicles')}
          className="group flex flex-col items-center gap-1 focus:outline-none"
          title="Fleet Vehicles & Controllers"
        >
          <div className="w-12 h-12 rounded-full bg-white border-2 border-[#d0d0d0] text-[#555] flex items-center justify-center shadow-sm group-hover:border-[#00c3e3] group-hover:scale-110 transition-all">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-[#666] group-hover:text-[#222]">Fleet</span>
        </button>

        {/* System Settings */}
        <button
          type="button"
          onClick={() => handleNav('/settings')}
          className="group flex flex-col items-center gap-1 focus:outline-none"
          title="System Settings"
        >
          <div className="w-12 h-12 rounded-full bg-white border-2 border-[#d0d0d0] text-[#555] flex items-center justify-center shadow-sm group-hover:border-[#00c3e3] group-hover:scale-110 transition-all">
            <Settings className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-[#666] group-hover:text-[#222]">Settings</span>
        </button>

        {/* Sleep / Logout */}
        {onLogoutClick && (
          <button
            type="button"
            onClick={() => {
              playSwitchSound('klick');
              onLogoutClick();
            }}
            className="group flex flex-col items-center gap-1 focus:outline-none"
            title="Lock Console / Sign Out"
          >
            <div className="w-12 h-12 rounded-full bg-white border-2 border-[#d0d0d0] text-[#888] flex items-center justify-center shadow-sm group-hover:border-[#ff4554] group-hover:text-[#ff4554] group-hover:scale-110 transition-all">
              <Power className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-[#666] group-hover:text-[#222]">Sleep</span>
          </button>
        )}
      </div>

      {/* Switch Joy-Con Controller Legend */}
      <div className="flex items-center gap-4 text-xs font-bold text-[#777]">
        <div className="flex items-center gap-1.5">
          <span className="switch-glyph-btn text-[#00c3e3] border-[#00c3e3]">A</span>
          <span>Select</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="switch-glyph-btn text-[#ff4554] border-[#ff4554]">B</span>
          <span>Back</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="switch-glyph-btn text-[#555] border-[#555]">+</span>
          <span>Options</span>
        </div>
      </div>
    </footer>
  );
}
