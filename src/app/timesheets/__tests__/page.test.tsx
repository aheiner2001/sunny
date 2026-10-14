import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TimesheetsPage, { metadata } from '../page';

vi.mock('../TimesheetsClient', () => ({
  default: () => <div data-testid="timesheets-client-stub">Timesheets Client Stub</div>,
}));

describe('TimesheetsPage (Route Component)', () => {
  it('exports page metadata with title and description', () => {
    expect(metadata.title).toBe('Timesheets | Sunny Fleet Accountability');
    expect(metadata.description).toBe(
      'Employee time records, individual shift approval, and weekly summaries.'
    );
  });

  it('renders TimesheetsClient component', () => {
    render(<TimesheetsPage />);
    expect(screen.getByTestId('timesheets-client-stub')).toBeDefined();
    expect(screen.getByText('Timesheets Client Stub')).toBeDefined();
  });
});
