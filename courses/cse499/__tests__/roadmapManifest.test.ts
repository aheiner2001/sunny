import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CSE 499 Roadmap Manifest', () => {
  const manifestPath = path.resolve(process.cwd(), 'courses/cse499/roadmap.json');
  const markdownPath = path.resolve(process.cwd(), 'courses/cse499/ROADMAP.md');

  it('contains valid roadmap.json with weeks 9 through 13', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(data.totalPlannedHours).toBe(60);
    expect(data.currentWeek).toBe(9);
    expect(data.weeks).toBeDefined();

    for (const weekNum of [9, 10, 11, 12, 13]) {
      const week = data.weeks[String(weekNum)];
      expect(week).toBeDefined();
      expect(week.title).toBeTruthy();
      expect(typeof week.plannedHours).toBe('number');
      expect(Array.isArray(week.courseRequirements)).toBe(true);
      expect(Array.isArray(week.engineeringPrinciples)).toBe(true);
      expect(Array.isArray(week.tasks)).toBe(true);
    }
  });

  it('contains human-readable ROADMAP.md guide', () => {
    expect(fs.existsSync(markdownPath)).toBe(true);
    const content = fs.readFileSync(markdownPath, 'utf8');
    expect(content).toContain('Sunny Fleet Senior Project (CSE 499)');
    expect(content).toContain('Week 9');
    expect(content).toContain('Week 10');
  });
});
