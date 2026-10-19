import { expect, it, vi } from 'vitest';
const authMocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(), getApps: () => [], getApp: vi.fn() }));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(), signInAnonymously: authMocks.signIn,
  onAuthStateChanged: (_auth: unknown, receive: any) => { queueMicrotask(() => receive(null)); return vi.fn(); },
}));
import { ensureAuth } from '../firebase';
it('allows sign-in to recover after the first anonymous authentication failure', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    authMocks.signIn.mockRejectedValueOnce(new Error('network-request-failed'))
      .mockResolvedValueOnce({ user: { uid: 'recovered' } });
    expect(await ensureAuth()).toBeNull();
    expect(await ensureAuth()).toEqual({ uid: 'recovered' });
    expect(authMocks.signIn).toHaveBeenCalledTimes(2);
  } finally { warning.mockRestore(); }
});
