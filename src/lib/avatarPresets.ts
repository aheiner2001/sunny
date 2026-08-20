import { User, UserRole } from '@/types';

export interface AvatarPreset {
  id: string;
  label: string;
  url: string;
}

const toDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const buildAvatarSvg = (background: string, foreground: string, shape: 'user' | 'shield' | 'star' | 'bolt') => {
  const shapeMarkup = {
    user: `
      <circle cx="48" cy="35" r="14" fill="${foreground}" />
      <rect x="27" y="54" width="42" height="24" rx="12" fill="${foreground}" />
    `,
    shield: `
      <path d="M48 18L72 28V46C72 62 62 74 48 80C34 74 24 62 24 46V28L48 18Z" fill="${foreground}" />
    `,
    star: `
      <path d="M48 20L56.1 36.4L74.2 39L61.1 51.7L64.2 69.8L48 61.3L31.8 69.8L34.9 51.7L21.8 39L39.9 36.4L48 20Z" fill="${foreground}" />
    `,
    bolt: `
      <path d="M54 16L31 49H45L39 80L64 44H50L54 16Z" fill="${foreground}" />
    `
  }[shape];

  return toDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="24" fill="${background}" />
      ${shapeMarkup}
    </svg>
  `);
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'slate-user', label: 'Slate User', url: buildAvatarSvg('#e2e8f0', '#334155', 'user') },
  { id: 'sky-shield', label: 'Sky Shield', url: buildAvatarSvg('#e0f2fe', '#0369a1', 'shield') },
  { id: 'emerald-star', label: 'Emerald Star', url: buildAvatarSvg('#dcfce7', '#047857', 'star') },
  { id: 'amber-bolt', label: 'Amber Bolt', url: buildAvatarSvg('#fef3c7', '#b45309', 'bolt') }
];

export const getRoleDefaultAvatarUrl = (role?: UserRole) =>
  role === 'manager' ? AVATAR_PRESETS[1].url : AVATAR_PRESETS[0].url;

export const getResolvedAvatarUrl = (user?: Pick<User, 'avatarUrl' | 'role'> | null) => {
  const explicit = user?.avatarUrl?.trim();
  if (explicit) return explicit;
  return getRoleDefaultAvatarUrl(user?.role);
};

export const findAvatarPresetByUrl = (url?: string | null) => {
  const needle = (url || '').trim();
  if (!needle) return null;
  return AVATAR_PRESETS.find(preset => preset.url === needle) || null;
};
