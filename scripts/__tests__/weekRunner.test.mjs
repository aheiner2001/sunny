import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Week Runner Script', () => {
  it('displays curriculum and tasks for week 9 when run via node', () => {
    const output = execSync('node scripts/week.mjs 9 --no-open', { encoding: 'utf8' });
    expect(output).toContain('WEEK 9: Automated Lambda CI/CD & Baseline Smoke Test');
    expect(output).toContain('ENGINEERING PRINCIPLES');
    expect(output).toContain('Infrastructure as Code');
    expect(output).toContain('TASKS');
    expect(output).toContain('W9.1');
  });

  it('fails gracefully when an invalid week number is passed', () => {
    expect(() => {
      execSync('node scripts/week.mjs 99 --no-open', { encoding: 'utf8' });
    }).toThrow();
  });
});
