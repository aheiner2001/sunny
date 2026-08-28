import { describe, expect, it } from 'vitest';
import { getPageTitle } from '@/lib/pageTitles';

describe('getPageTitle', () => {
  it('resolves /vehicles to Vehicles', () => {
    expect(getPageTitle('/vehicles')).toBe('Vehicles');
  });

  it('resolves /issues to Issues', () => {
    expect(getPageTitle('/issues')).toBe('Issues');
  });

  it('resolves /dashboard to Dashboard', () => {
    expect(getPageTitle('/dashboard')).toBe('Dashboard');
  });
});
