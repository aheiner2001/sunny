import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService } from '@/lib/db';
import { DEFAULT_RETURN_QUESTIONS } from '@/lib/returnFlow';

vi.mock('@/lib/firebase', () => ({
  db: null,
  ensureAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

describe('returnQuestions config', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults returnQuestions when config omits them', () => {
    const cfg = dbService.getChecklistConfig();
    expect(cfg.returnQuestions?.length).toBeGreaterThan(0);
    expect(cfg.returnQuestions?.[0].id).toBe(DEFAULT_RETURN_QUESTIONS[0].id);
  });
});
