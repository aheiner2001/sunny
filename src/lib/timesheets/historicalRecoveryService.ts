import { dbService } from '@/lib/db';
import { timesheetStore } from './timesheetStore';
import { buildHistoricalEstimates, makeRecoveredShift } from './historicalRecovery';

export async function recoverHistoricalEstimate(inspectionId: string, actor: { id: string; name: string }) {
  // Rebuild from the current evidence, shifts and requests; never trust an old preview row.
  const row = buildHistoricalEstimates(dbService.getInspections(), timesheetStore.getAllShifts(),
    timesheetStore.getAllCorrectionRequests(), dbService.getMissedReturns()).find(candidate => candidate.inspectionId === inspectionId);
  if (!row) throw new Error('Inspection evidence is no longer available. Refresh the preview.');
  return timesheetStore.saveRecoveredShift(makeRecoveredShift(row, actor));
}
