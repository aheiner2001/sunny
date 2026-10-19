import { dbService } from '@/lib/db';
import { timesheetService } from './timesheetService';

/** Shared by both in-app scanners. Direct printed URLs also punch at inspection entry. */
export async function clockInScanEmployee(): Promise<void> {
  const session = dbService.getSession();
  if (!session) throw new Error('Sign in before starting an inspection.');
  if (session.role === 'manager') return;
  const name = (session as { userName?: string }).userName || dbService.getUser(session.userId)?.name || 'Employee';
  await timesheetService.clockIn(session.userId, name, 'qr', `qr-scan-${crypto.randomUUID()}`);
}
