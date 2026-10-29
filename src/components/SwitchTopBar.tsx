'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getResolvedAvatarUrl } from '@/lib/avatarPresets';
import { Wifi, BatteryMedium, Shield } from 'lucide-react';
import { playSwitchSound } from '@/lib/switchAudio';

export function SwitchTopBar({ onProfileClick }: { onProfileClick?: () => void }) {
  const { user, role } = useAuth();
  const [timeStr, setTimeStr] = useState('12:00 PM');
  const avatarUrl = getResolvedAvatarUrl(user);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full flex items-center justify-between px-6 py-3 select-none border-b border-[#dadada] bg-[#ebebeb] text-[#2d2d2d]">
      {/* User profile with Switch cyan ring */}
      <button
        type="button"
        onClick={() => {
          playSwitchSound('user');
          if (onProfileClick) onProfileClick();
        }}
        className="flex items-center gap-3 group focus:outline-none"
        title="User Settings / Switch Profile"
      >
        <div className="relative w-11 h-11 rounded-full p-[2.5px] bg-white border-2 border-[#2d2d2d] group-hover:border-[#00c3e3] group-hover:scale-105 transition-all shadow-sm">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className="w-full h-full rounded-full bg-[#00c3e3] text-white flex items-center justify-center font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || 'M'}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00c3e3] border-2 border-white" />
        </div>
        <div className="text-left">
          <div className="text-sm font-bold tracking-tight group-hover:text-[#00c3e3] transition-colors flex items-center gap-1.5">
            {user?.name || 'Manager'}
            {role === 'manager' && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#2d2d2d] text-white">
                Manager
              </span>
            )}
          </div>
          <div className="text-xs text-[#7c7c7c]">Online</div>
        </div>
      </button>

      {/* Switch System Tray (Time, Wifi, Battery) */}
      <div className="flex items-center gap-4 text-xs font-semibold text-[#555]">
        <div className="flex items-center gap-1 tracking-tight text-sm font-bold text-[#2d2d2d]">
          {timeStr}
        </div>
        <div className="flex items-center gap-2 border-l border-[#ccc] pl-3">
          <Wifi className="w-4 h-4 text-[#2d2d2d]" aria-hidden />
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold">100%</span>
            <BatteryMedium className="w-5 h-5 text-[#2d2d2d]" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
