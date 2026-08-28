import { NAV_ITEMS } from '@/lib/navItems';

export const PAGE_TITLES: Record<string, string> = {
  '/home': 'Home',
  '/vehicles/detail': 'Vehicle',
};

export function getPageTitle(pathname: string): string {
  const base = pathname.split('?')[0];
  if (PAGE_TITLES[base]) return PAGE_TITLES[base];
  const match = NAV_ITEMS.find(
    item => base === item.href || (item.href !== '/dashboard' && base.startsWith(item.href)),
  );
  return match?.label || 'Sunny Fleet';
}
