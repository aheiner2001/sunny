import { beforeEach, expect, it, vi } from 'vitest';

// A transactional document store: only publishes writes after the callback succeeds.
const cloud = vi.hoisted(() => ({ docs: new Map<string, any>(), fail: false, queue: Promise.resolve() }));
vi.mock('@/lib/firebase', () => ({ db: { _isMock: true }, ensureAuth: vi.fn().mockResolvedValue({ uid: 'test' }) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => `${col}/${id}`,
  collection: (_db: unknown, name: string) => name,
  setDoc: vi.fn(), deleteDoc: vi.fn(), onSnapshot: vi.fn(), getDocs: vi.fn(),
  runTransaction: vi.fn((_db: unknown, callback: any) => {
    const result = cloud.queue.then(async () => {
      if (cloud.fail) throw new Error('permission-denied');
      const pending = new Map<string, any>();
      const value = await callback({
        get: async (key: string) => ({ exists: () => cloud.docs.has(key), data: () => cloud.docs.get(key) }),
        set: (key: string, data: any) => pending.set(key, data),
      });
      pending.forEach((value, key) => cloud.docs.set(key, value));
      return value;
    });
    cloud.queue = result.then(() => undefined, () => undefined);
    return result;
  }),
}));
import { timesheetService } from '../timesheetService';
import { timesheetStore } from '../timesheetStore';
beforeEach(() => { timesheetStore.reset(); cloud.docs.clear(); cloud.fail = false; cloud.queue = Promise.resolve(); });
const start = () => timesheetService.clockIn('driver', 'Driver', 'qr', 'scan-1', '2026-10-19T14:00:00Z');
it('does not confirm a punch or cache an active shift when persistence fails', async () => {
  cloud.fail = true;
  await expect(start()).rejects.toThrow('permission-denied');
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
});
it('finds and closes the remote shift after browser storage is cleared', async () => {
  const shift = await start();
  timesheetStore.reset();
  const ended = await timesheetService.clockOut('driver', 'checklist_return', 'return-1', 0, '2026-10-19T22:00:00Z');
  expect(ended).toMatchObject({ id: shift.id, status: 'pending' });
  expect(cloud.docs.get(`timesheet_shifts/${shift.id}`).status).toBe('pending');
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBeNull();
});
it('keeps one shift and its start time across simultaneous scans and a fresh browser', async () => {
  const [first, second] = await Promise.all([start(), timesheetService.clockIn('driver', 'Driver', 'qr', 'scan-2')]);
  expect(second.id).toBe(first.id);
  timesheetStore.reset();
  expect((await start()).id).toBe(first.id);
  expect(Array.from(cloud.docs.keys()).filter(key => key.startsWith('timesheet_shifts/'))).toHaveLength(1);
});
it('retries an acknowledged return without closing a later shift', async () => {
  const original = await start();
  await timesheetService.clockOut('driver', 'checklist_return', 'return-1', 0, '2026-10-19T22:00:00Z');
  const later = await timesheetService.clockIn('driver', 'Driver', 'qr', 'scan-3', '2026-10-20T14:00:00Z');
  timesheetStore.reset();
  const retry = await timesheetService.clockOut('driver', 'checklist_return', 'return-1');
  expect(retry.id).toBe(original.id);
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBe(later.id);
});
