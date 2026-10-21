import { beforeEach, expect, it, vi } from 'vitest';
import type { Inspection } from '@/types';

const mocks = vi.hoisted(() => ({
  getInspections: vi.fn(),
  getMissedReturns: vi.fn(),
  getAllShifts: vi.fn(),
  getAllCorrectionRequests: vi.fn(),
  saveRecoveredShift: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  dbService: {
    getInspections: mocks.getInspections,
    getMissedReturns: mocks.getMissedReturns,
  },
}));

vi.mock('../timesheetStore', () => ({
  timesheetStore: {
    getAllShifts: mocks.getAllShifts,
    getAllCorrectionRequests: mocks.getAllCorrectionRequests,
    saveRecoveredShift: mocks.saveRecoveredShift,
  },
}));

import { recoverHistoricalEstimateWithManualEnd } from '../historicalRecoveryService';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInspections.mockReturnValue([{
    id: 'pre-1',
    userId: 'driver',
    userName: 'Driver',
    vehicleId: 'van',
    vehicleNumber: '5',
    submittedAt: '2026-10-12T14:00:00Z',
    kind: 'pretrip',
    status: 'passed',
  } as Inspection]);
  mocks.getMissedReturns.mockReturnValue([]);
  mocks.getAllShifts.mockReturnValue([]);
  mocks.getAllCorrectionRequests.mockReturnValue([]);
  mocks.saveRecoveredShift.mockImplementation(async shift => shift);
});

it('rebuilds manual-end recovery from current evidence and forwards the end time', async () => {
  const result = await recoverHistoricalEstimateWithManualEnd(
    'pre-1',
    '2026-10-12T22:00:00.000Z',
    { id: 'manager', name: 'Manager' },
  );

  expect(mocks.getInspections).toHaveBeenCalledOnce();
  expect(mocks.getAllShifts).toHaveBeenCalledOnce();
  expect(mocks.getAllCorrectionRequests).toHaveBeenCalledOnce();
  expect(mocks.getMissedReturns).toHaveBeenCalledOnce();
  expect(mocks.saveRecoveredShift).toHaveBeenCalledWith(expect.objectContaining({
    startAtUtc: '2026-10-12T14:00:00.000Z',
    endAtUtc: '2026-10-12T22:00:00.000Z',
    recovery: expect.objectContaining({
      inspectionId: 'pre-1',
      returnInspectionId: null,
      manualEnd: true,
    }),
  }));
  expect(result.endAtUtc).toBe('2026-10-12T22:00:00.000Z');
});

it('throws when inspection evidence is missing', async () => {
  mocks.getInspections.mockReturnValue([]);
  await expect(recoverHistoricalEstimateWithManualEnd(
    'pre-1',
    '2026-10-12T22:00:00.000Z',
    { id: 'manager', name: 'Manager' },
  )).rejects.toThrow(/inspection evidence/i);
  expect(mocks.saveRecoveredShift).not.toHaveBeenCalled();
});
