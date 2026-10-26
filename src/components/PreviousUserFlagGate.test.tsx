import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PreviousUserFlagGate from './PreviousUserFlagGate';
import { dbService } from '@/lib/db';
import type { PreviousUserFlag } from '@/types';

vi.mock('@/lib/db', () => ({
  dbService: {
    getOpenPreviousUserFlagsForEmployee: vi.fn(() => []),
    acknowledgePreviousUserFlags: vi.fn(async () => []),
  },
}));

const flag = (overrides: Partial<PreviousUserFlag> = {}): PreviousUserFlag => ({
  id: 'flag-1',
  employeeId: 'alex',
  employeeName: 'Alex',
  vehicleId: 'van',
  vehicleNumber: '5',
  questionId: 'cab',
  questionText: 'Is the cab clean?',
  inspectionId: 'insp-1',
  message: 'Clean before you leave.',
  status: 'open',
  createdAt: '2026-09-29T14:37:06Z',
  createdById: 'jacob',
  acknowledgedAt: null,
  ...overrides,
});

describe('PreviousUserFlagGate', () => {
  beforeEach(() => {
    vi.mocked(dbService.getOpenPreviousUserFlagsForEmployee).mockReturnValue([]);
    vi.mocked(dbService.acknowledgePreviousUserFlags).mockResolvedValue([]);
  });

  it('renders children when the employee has no open flags', () => {
    render(
      <PreviousUserFlagGate employeeId="alex">
        <div>Checklist ready</div>
      </PreviousUserFlagGate>,
    );
    expect(screen.getByText('Checklist ready')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: /previous-use feedback/i })).toBeNull();
  });

  it('blocks children until Acknowledge clears the open batch', async () => {
    let open: PreviousUserFlag[] = [flag()];
    vi.mocked(dbService.getOpenPreviousUserFlagsForEmployee).mockImplementation(() => open);
    vi.mocked(dbService.acknowledgePreviousUserFlags).mockImplementation(async () => {
      open = [];
      return [flag({ status: 'acknowledged', acknowledgedAt: '2026-09-30T12:00:00Z' })];
    });

    render(
      <PreviousUserFlagGate employeeId="alex">
        <div>Checklist ready</div>
      </PreviousUserFlagGate>,
    );

    expect(screen.getByRole('dialog', { name: /previous-use feedback/i })).toBeDefined();
    expect(screen.queryByText('Checklist ready')).toBeNull();
    expect(screen.getByText(/Clean before you leave/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }));

    await waitFor(() => {
      expect(dbService.acknowledgePreviousUserFlags).toHaveBeenCalledWith('alex');
      expect(screen.getByText('Checklist ready')).toBeDefined();
    });
  });
});
