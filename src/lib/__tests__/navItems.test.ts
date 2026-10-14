import { describe, expect, it } from 'vitest';
import { Clock } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/navItems';
import { getPageTitle } from '@/lib/pageTitles';

describe('Navigation items and /timesheets route registration', () => {
  it('registers /timesheets in NAV_ITEMS with Clock icon', () => {
    const timesheetsItem = NAV_ITEMS.find(item => item.href === '/timesheets');
    expect(timesheetsItem).toBeDefined();
    expect(timesheetsItem?.label).toBe('Timesheets');
    expect(timesheetsItem?.icon).toBe(Clock);
  });

  it('makes /timesheets accessible to both employees and managers', () => {
    const timesheetsItem = NAV_ITEMS.find(item => item.href === '/timesheets');
    expect(timesheetsItem).toBeDefined();
    // Neither managerOnly nor employeeOnly should restrict it
    expect(timesheetsItem?.managerOnly).toBeFalsy();
    expect(timesheetsItem?.employeeOnly).toBeFalsy();
  });

  it('resolves page title for /timesheets to Timesheets', () => {
    expect(getPageTitle('/timesheets')).toBe('Timesheets');
    expect(getPageTitle('/timesheets?week=2026-W42')).toBe('Timesheets');
  });
});
