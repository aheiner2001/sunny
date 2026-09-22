import { describe, expect, it } from 'vitest';
import { activeChecklistQuestions, isDateInSeason } from './checklistQuestions';
import type { ChecklistQuestion } from '@/types';

const base = {
  category: 'general',
  type: 'yes_no' as const,
  required: true,
  order: 1,
};

describe('isDateInSeason', () => {
  it('handles non-wrapping windows', () => {
    expect(isDateInSeason('06-01', '08-31', new Date('2026-07-15'))).toBe(true);
    expect(isDateInSeason('06-01', '08-31', new Date('2026-05-15'))).toBe(false);
  });

  it('handles New Year wrap (Dec–Feb)', () => {
    expect(isDateInSeason('12-01', '02-28', new Date('2026-12-15'))).toBe(true);
    expect(isDateInSeason('12-01', '02-28', new Date('2026-01-15'))).toBe(true);
    expect(isDateInSeason('12-01', '02-28', new Date('2026-06-15'))).toBe(false);
  });
});

describe('activeChecklistQuestions', () => {
  it('keeps permanent and unexpired temporary questions', () => {
    const qs: ChecklistQuestion[] = [
      { ...base, id: '1', text: 'Always' },
      { ...base, id: '2', text: 'Temp', isTemporary: true, expiresAt: '2099-01-01' },
      { ...base, id: '3', text: 'Expired', isTemporary: true, expiresAt: '2020-01-01' },
    ];
    const active = activeChecklistQuestions(qs, new Date('2026-09-16'));
    expect(active.map((q) => q.id)).toEqual(['1', '2']);
  });

  it('shows seasonal in window and hides outside', () => {
    const qs: ChecklistQuestion[] = [
      {
        ...base,
        id: 's',
        text: 'Drain tanks',
        isSeasonal: true,
        seasonStart: '12-01',
        seasonEnd: '02-28',
      },
    ];
    expect(activeChecklistQuestions(qs, new Date('2026-01-10')).map((q) => q.id)).toEqual(['s']);
    expect(activeChecklistQuestions(qs, new Date('2026-07-10')).map((q) => q.id)).toEqual([]);
  });

  it('forcePaused hides seasonal inside window', () => {
    const qs: ChecklistQuestion[] = [
      {
        ...base,
        id: 's',
        text: 'Drain tanks',
        isSeasonal: true,
        seasonStart: '12-01',
        seasonEnd: '02-28',
        forcePaused: true,
      },
    ];
    expect(activeChecklistQuestions(qs, new Date('2026-12-15')).map((q) => q.id)).toEqual([]);
  });

  it('forceActive shows seasonal outside window', () => {
    const qs: ChecklistQuestion[] = [
      {
        ...base,
        id: 's',
        text: 'Drain tanks',
        isSeasonal: true,
        seasonStart: '12-01',
        seasonEnd: '02-28',
        forceActive: true,
      },
    ];
    expect(activeChecklistQuestions(qs, new Date('2026-07-10')).map((q) => q.id)).toEqual(['s']);
  });

  it('excludes questions with enabled===false (manager disable toggle)', () => {
    const qs: ChecklistQuestion[] = [
      { ...base, id: 'on', text: 'Enabled by default' },
      { ...base, id: 'explicit', text: 'Explicitly on', enabled: true },
      { ...base, id: 'off', text: 'Turned off', enabled: false },
    ];
    expect(activeChecklistQuestions(qs, new Date('2026-09-16')).map((q) => q.id)).toEqual([
      'on',
      'explicit',
    ]);
  });

  it('persistence pairing: disable then re-enable via field update mirrors Settings toggle', () => {
    let qs: ChecklistQuestion[] = [
      { ...base, id: 'q1', text: 'Lights work?' },
      { ...base, id: 'q2', text: 'Tires OK?' },
    ];
    // Simulate Settings toggle OFF + persist payload
    qs = qs.map((q) => (q.id === 'q1' ? { ...q, enabled: false } : q));
    expect(activeChecklistQuestions(qs).map((q) => q.id)).toEqual(['q2']);
    // Simulate Settings toggle ON again
    qs = qs.map((q) => (q.id === 'q1' ? { ...q, enabled: true } : q));
    expect(activeChecklistQuestions(qs).map((q) => q.id)).toEqual(['q1', 'q2']);
  });
});
