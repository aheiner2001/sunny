import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { getThemeMode } from '@/lib/themeMode';

describe('ThemeSwitcher Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders theme options and updates mode on toggle', () => {
    render(<ThemeSwitcher variant="pills" />);
    const switchBtn = screen.getByRole('button', { name: /switch ui/i });
    expect(switchBtn).toBeDefined();

    fireEvent.click(switchBtn);
    expect(getThemeMode()).toBe('switch');

    const classicBtn = screen.getByRole('button', { name: /classic/i });
    fireEvent.click(classicBtn);
    expect(getThemeMode()).toBe('classic');
  });
});
