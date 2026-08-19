'use client';

import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Camera, 
  X, 
  Check, 
  Sparkles, 
  Image as ImageIcon,
  Shield,
  Upload
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80'
];

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || AVATAR_PRESETS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      await updateProfile({
        name: name.trim(),
        avatarUrl: avatarUrl.trim()
      });
      setSuccessMessage(true);
      setTimeout(() => {
        setSuccessMessage(false);
        onClose();
      }, 700);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setAvatarUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Customize Profile</h3>
              <p className="text-[11px] text-slate-400">Update your profile photo and display name</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar Preview & Custom Upload */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-3">
              <img
                src={avatarUrl}
                alt="Profile Preview"
                className="w-24 h-24 rounded-3xl object-cover ring-4 ring-sky-500/20 shadow-md transition-transform group-hover:scale-105"
              />
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-lg cursor-pointer transition-transform hover:scale-110"
                title="Upload Photo"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Click the upload icon or select a preset below:
            </p>
          </div>

          {/* Preset Avatar Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Preset Avatars
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_PRESETS.map((preset, idx) => {
                const isSelected = avatarUrl === preset;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(preset)}
                    className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition-all ${
                      isSelected ? 'border-sky-600 ring-2 ring-sky-500/30 scale-105' : 'border-transparent hover:opacity-80'
                    }`}
                  >
                    <img src={preset} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-sky-600/30 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom URL Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Or Image URL
            </label>
            <div className="relative">
              <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={avatarUrl.startsWith('data:') ? 'Custom Uploaded Image' : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {successMessage ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Saved!</span>
                </>
              ) : isSaving ? (
                'Saving...'
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
