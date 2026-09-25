import { describe, expect, it } from 'vitest';
import { compactConfirmedInspections } from '../inspectionCache';
import type { Inspection } from '@/types';

const photo = 'data:image/jpeg;base64,abc123';
const inspection = (id: string): Inspection => ({
  id, vehicleId: 'van-1', vehicleNumber: '1', userId: 'employee', userName: 'Employee',
  userEmail: '', status: 'passed', startedAt: '2026-09-25T10:00:00Z', submittedAt: '2026-09-25T10:10:00Z',
  dateString: '2026-09-25', responses: [{ questionId: 'photo', questionText: 'Photo', category: 'general', value: 'captured', isFlagged: false, photoUrl: photo }],
  issueIds: [], photoUrls: [photo], signatureBase64: 'data:image/png;base64,signature',
});

describe('inspection browser cache', () => {
  it('removes embedded images only when an identical cloud copy is confirmed', () => {
    const synced = inspection('synced');
    const pending = inspection('pending');
    const [cached, local] = compactConfirmedInspections([synced, pending], new Map([[synced.id, synced]]));
    expect(cached.responses[0].photoUrl).toBeUndefined();
    expect(cached.photoUrls).toBeUndefined();
    expect(cached.signatureBase64).toBeUndefined();
    expect(local).toEqual(pending);
    expect(synced.responses[0].photoUrl).toBe(photo);
  });

  it('keeps a local photo when the cloud copy does not contain it', () => {
    const local = inspection('different');
    const remote = { ...local, responses: [{ ...local.responses[0], photoUrl: undefined }], photoUrls: undefined };
    const [cached] = compactConfirmedInspections([local], new Map([[local.id, remote]]));
    expect(cached.responses[0].photoUrl).toBe(photo);
    expect(cached.photoUrls).toEqual([photo]);
    expect(cached.signatureBase64).toBeUndefined();
  });
});
