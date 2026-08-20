'use client';

import React, { useEffect, useState } from 'react';
import { 
  User as UserIcon, 
  Camera, 
  X, 
  Check, 
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarStyle, setAvatarStyle] = useState(user?.avatarStyle || 'circle');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      setAvatarUrl(user.avatarUrl || '');
      setAvatarStyle(user.avatarStyle || 'circle');
      setSuccessMessage(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      await updateProfile({
        name: name.trim(),
        avatarUrl: avatarUrl.trim(),
        avatarStyle
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
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile Preview"
                  className={`w-24 h-24 object-cover ring-4 ring-sky-500/20 shadow-md transition-transform group-hover:scale-105 ${
                    avatarStyle === 'circle' ? 'rounded-full' : avatarStyle === 'square' ? 'rounded-none' : 'rounded-3xl'
                  }`}
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-slate-100 text-slate-400 ring-4 ring-sky-500/20 shadow-md flex items-center justify-center">
                  <UserIcon className="w-10 h-10" />
                </div>
              )}
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-lg cursor-pointer transition-transform hover:scale-110"
                title="Upload Photo"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Upload a PNG, JPG, or WebP photo, or provide an image URL:
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Photo Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['circle', 'Circle'],
                ['rounded', 'Rounded'],
                ['square', 'Square']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAvatarStyle(value)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold ${
                    avatarStyle === value
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
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
                type="text"
                placeholder="https://images.unsplash.com/..."
                value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
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
