import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '@/lib/db';

describe('dbService inventory smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    // Force re-init of seed data on next call
    (dbService as any).initialized = false;
  });

  it('exposes returnEquipmentToShop', () => {
    expect(typeof (dbService as any).returnEquipmentToShop).toBe('function');
  });
});
