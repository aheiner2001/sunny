import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const saveTrainingItems = vi.fn();
const saveTrainingAssignment = vi.fn();
const getTrainingItems = vi.fn(() => []);
const getTrainingAssignments = vi.fn(() => []);
const getTraineeTrainerLinks = vi.fn(() => []);
const getUsers = vi.fn(() => [
  { id: 'emp-1', name: 'Alex', role: 'employee', status: 'active', isDesignatedTrainer: true },
  { id: 'emp-2', name: 'Sam', role: 'employee', status: 'active' },
]);

vi.mock('@/lib/db', () => ({
  dbService: {
    getTrainingItems: () => getTrainingItems(),
    getTrainingAssignments: () => getTrainingAssignments(),
    getTraineeTrainerLinks: () => getTraineeTrainerLinks(),
    getUsers: () => getUsers(),
    getChecklistConfig: () => ({
      questions: [
        {
          id: 'q-caddy',
          text: 'Chemical caddy filled?',
          type: 'yes_no',
          holdPreviousUserAccountable: true,
          order: 1,
          category: 'supplies',
          required: true,
        },
      ],
      returnQuestions: [],
    }),
    saveTrainingItems: (...args: unknown[]) => saveTrainingItems(...args),
    saveTrainingAssignment: (...args: unknown[]) => saveTrainingAssignment(...args),
    saveTraineeTrainerLink: vi.fn(),
  },
}));

vi.mock('@/components/CurriculumSortList', () => ({
  CurriculumSortList: () => <div data-testid="curriculum-sort-list" />,
}));

vi.mock('@/components/TrainingLearnChart', () => ({
  TrainingLearnChart: () => <div data-testid="learn-chart" />,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'mgr-1', name: 'Morgan', role: 'manager' },
    role: 'manager',
  }),
}));

vi.mock('@/components/ManagerOnly', () => ({
  ManagerOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import TrainingPage from '../page';

describe('Training page primary actions', () => {
  beforeEach(() => {
    saveTrainingItems.mockReset();
    saveTrainingAssignment.mockReset();
    getTrainingItems.mockReturnValue([]);
    getTrainingAssignments.mockReturnValue([]);
    saveTrainingItems.mockRejectedValue(new Error('Firestore permission denied'));
  });

  it('asks for a title when Add is clicked with an empty field', async () => {
    render(<TrainingPage />);
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/enter a training step title/i);
    expect(saveTrainingItems).not.toHaveBeenCalled();
  });

  it('surfaces an error when curriculum Add fails instead of failing silently', async () => {
    render(<TrainingPage />);
    fireEvent.change(screen.getByLabelText('New training step title'), {
      target: { value: 'Cab wipe-down' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission denied/i);
    expect(screen.queryByText('Training step saved.')).toBeNull();
  });

  it('persists a curriculum step and shows success when the write works', async () => {
    saveTrainingItems.mockResolvedValueOnce(undefined);
    render(<TrainingPage />);
    fireEvent.change(screen.getByLabelText('New training step title'), {
      target: { value: 'Cab wipe-down' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(saveTrainingItems).toHaveBeenCalled());
    expect((await screen.findByRole('status')).textContent).toMatch(/training step saved/i);
  });
});
