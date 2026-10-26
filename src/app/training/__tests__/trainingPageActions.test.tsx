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
let currentAuth = {
  user: { id: 'mgr-1', name: 'Morgan', role: 'manager' },
  role: 'manager',
};

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
  useAuth: () => currentAuth,
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
    currentAuth = {
      user: { id: 'mgr-1', name: 'Morgan', role: 'manager' },
      role: 'manager',
    };
  });

  it('does not show manager-irrelevant sections', () => {
    render(<TrainingPage />);

    expect(screen.queryByRole('heading', { name: /^my training$/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^onboarding$/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^all assignments$/i })).toBeNull();
    expect(screen.getByRole('heading', { name: /^learn chart$/i })).toBeTruthy();
    expect(screen.getByTestId('learn-chart')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^people$/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^needs attention$/i })).toBeTruthy();
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

  it('shows employee certification without manager sections', async () => {
    currentAuth = {
      user: { id: 'emp-2', name: 'Sam', role: 'employee' },
      role: 'employee',
    };
    getTrainingAssignments.mockReturnValue([
      {
        id: 'assignment-1',
        traineeId: 'emp-2',
        traineeName: 'Sam',
        itemId: 'item-1',
        status: 'awaiting_trainee',
        dueAt: null,
        missStreak: 0,
        events: [],
        createdAt: '2026-10-26T12:00:00Z',
        updatedAt: '2026-10-26T12:00:00Z',
      },
    ]);

    render(<TrainingPage />);

    expect(
      await screen.findByRole('button', { name: /^i was trained — certify$/i }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^my training$/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /^people$/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^needs attention$/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^curriculum$/i })).toBeNull();
  });
});
