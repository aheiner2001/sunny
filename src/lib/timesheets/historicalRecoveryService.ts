import { dbService } from '@/lib/db';
import { timesheetStore } from './timesheetStore';
import type { ShiftRecord } from './types';
import { buildHistoricalEstimates, makeManualEndRecoveredShift, makeRecoveredShift } from './historicalRecovery';

export async function recoverHistoricalEstimate(inspectionId: string, actor: { id: string; name: string }) {
  // Rebuild from the current evidence, shifts and requests; never trust an old preview row.
  const row = buildHistoricalEstimates(dbService.getInspections(), timesheetStore.getAllShifts(),
    timesheetStore.getAllCorrectionRequests(), dbService.getMissedReturns()).find(candidate => candidate.inspectionId === inspectionId);
  if (!row) throw new Error('Inspection evidence is no longer available. Refresh the preview.');
  return timesheetStore.saveRecoveredShift(makeRecoveredShift(row, actor));
}

export async function recoverHistoricalEstimateWithManualEnd(
  inspectionId: string,
  endAtUtc: string,
  actor: { id: string; name: string },
): Promise<ShiftRecord> {
  const row = buildHistoricalEstimates(
    dbService.getInspections(),
    timesheetStore.getAllShifts(),
    timesheetStore.getAllCorrectionRequests(),
    dbService.getMissedReturns(),
  ).find(candidate => candidate.inspectionId === inspectionId);
  if (!row) throw new Error('Inspection evidence is no longer available. Refresh the preview.');
  return timesheetStore.saveRecoveredShift(makeManualEndRecoveredShift(row, endAtUtc, actor));
}
