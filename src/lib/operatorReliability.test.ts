import { describe, expect, it } from 'vitest';
import type { Inspection, Issue, User } from '@/types';
import { buildOperatorScorecards } from './operatorReliability';
import { findPossibleMissedIssues } from './possibleMissedIssues';

const users: User[] = ['prior', 'reporter'].map(id => ({ id, name: id, status: 'active', role: 'employee' }));
const inspection = (id: string, userId = 'reporter', overrides: Partial<Inspection> = {}): Inspection => ({
  id, userId, userName: userId, userEmail: '', vehicleId: 'van', vehicleNumber: '1',
  status: 'passed', startedAt: '2026-10-14T08:00:00Z', submittedAt: '2026-10-14T08:10:00Z',
  dateString: '2026-10-14', responses: [], issueIds: [], ...overrides,
});
const issue = (id: string, overrides: Partial<Issue> = {}): Issue => ({
  id, vehicleId: 'van', vehicleNumber: '1', equipmentName: 'tool', reportedById: 'reporter',
  reportedByName: 'reporter', reportedAt: '2026-10-14T09:00:00Z', dateString: '2026-10-14',
  inspectionId: 'later', title: 'Broken tool', description: '', status: 'open', ...overrides,
});
const paired = Array.from({ length: 10 }, (_, n) => inspection(`i${n}`, 'reporter', {
  kind: n % 2 ? 'return' : 'pretrip', submittedAt: `2026-10-${10 + Math.floor(n / 2)}T${n % 2 ? '17' : '08'}:00:00Z`,
}));

describe('operator diligence scorecards', () => {
  it('never reduces diligence for finding defects and rewards discoveries', () => {
    const clean = buildOperatorScorecards(users, paired, [], [] ).find(s => s.user.id === 'reporter')!;
    const findings = paired.map(i => ({ ...i, status: 'issues_found' as const, issueIds: [i.id] }));
    const diligent = buildOperatorScorecards(users, findings, findings.map(i => issue(i.id, { inspectionId: i.id })), []).find(s => s.user.id === 'reporter')!;
    expect(clean.baseDiligence).toBe(70);
    expect(diligent.baseDiligence).toBe(clean.baseDiligence);
    expect(diligent.integrityBonus).toBe(15);
    expect(diligent.score).toBe(85);
    expect(diligent.bonusStatus).toBe('Qualified');
  });
  it('counts submission days and paired vehicle-day checklists, not repeated submissions', () => {
    const rows = [inspection('a'), inspection('b'), inspection('c', 'reporter', { kind: 'return' }), inspection('d', 'reporter', { vehicleId: 'other' })];
    const result = buildOperatorScorecards(users, rows, [], []).find(s => s.user.id === 'reporter')!;
    expect(result.activeDays).toBe(1);
    expect(result.completedShifts).toBe(1);
    expect(result.observedShifts).toBe(2);
    expect(result.consistency).toBe(50);
  });
  it('deducts the prior operator only and groups multiple defects in one handoff', () => {
    const rows = [inspection('prior', 'prior'), inspection('later', 'reporter', { submittedAt: '2026-10-14T09:00:00Z', status: 'issues_found' })];
    const issues = [issue('one'), issue('two', { priority: 'critical' })];
    const signals = findPossibleMissedIssues(issues, rows, { windowHours: 72 });
    const result = buildOperatorScorecards(users, rows, issues, signals);
    const prior = result.find(s => s.user.id === 'prior')!;
    const reporter = result.find(s => s.user.id === 'reporter')!;
    expect(signals[0].priorUserId).toBe('prior');
    expect(prior.handoffFlags).toBe(1);
    expect(prior.discrepancyPenalty).toBe(25);
    expect(reporter.handoffFlags).toBe(0);
    expect(reporter.integrityBonus).toBe(6);
  });
  it('handles no inspections, drafts, invalid dates and duplicate names without phantom scores', () => {
    const sameName = users.map(u => ({ ...u, name: 'Alex' }));
    const result = buildOperatorScorecards(sameName, [inspection('a', 'reporter', { userName: 'Alex' }), inspection('draft', 'prior', { status: 'in_progress' }), inspection('bad', 'prior', { submittedAt: 'bad' })], [], []);
    expect(result.find(s => s.user.id === 'prior')!.score).toBe(0);
    expect(result.find(s => s.user.id === 'prior')!.bonusStatus).toBe('Ineligible');
    expect(result.find(s => s.user.id === 'reporter')!.totalInspections).toBe(1);
  });
  it('retains deleted operators and gives legacy unnamed records a safe identity', () => {
    const result = buildOperatorScorecards([], [inspection('old', 'deleted'), inspection('unknown', '', { userName: '' })], [], []);
    expect(result.map(s => s.user.name)).toEqual(expect.arrayContaining(['deleted', 'Unknown operator']));
    expect(result).toHaveLength(2);
  });
  it('counts one discovery when an issue and its flagged response describe the same finding', () => {
    const row = inspection('later', 'reporter', { status: 'issues_found', issueIds: ['one'], responses: [{ questionId: 'q', questionText: 'Tool', category: 'equipment', value: false, isFlagged: true }] });
    expect(buildOperatorScorecards(users, [row], [issue('one'), issue('one')], []).find(s => s.user.id === 'reporter')!.integrityBonus).toBe(3);
  });
  it('uses the linked checklist when an issue has no reporting identity', () => {
    const result = buildOperatorScorecards(users, [inspection('later')], [issue('one', { reportedById: '', reportedByName: '' })], []);
    expect(result.find(s => s.user.id === 'reporter')!.integrityBonus).toBe(3);
    expect(result.some(s => s.user.name === 'Unknown operator')).toBe(false);
  });
  it('requires minimum volume and no discrepancies, with repeated handoffs ineligible', () => {
    const discoveries = Array.from({ length: 5 }, (_, n) => issue(`issue${n}`));
    const signal = { issueId: 'issue0', issueTitle: 'Tool', vehicleId: 'van', flaggedAt: '2026-10-14T09:00:00Z', flaggedByInspectionId: 'next', flaggedByUserId: 'other', priorInspectionId: 'i0', priorUserId: 'reporter', priorUserName: 'reporter', priorSubmittedAt: '2026-10-13T17:00:00Z', windowHours: 72, kind: 'possible_missed_issue' as const };
    const scorecard = (signals: typeof signal[]) => buildOperatorScorecards(users, paired, discoveries, signals).find(s => s.user.id === 'reporter')!;
    expect(scorecard([]).bonusStatus).toBe('Qualified');
    expect(scorecard([signal])).toMatchObject({ score: 75, bonusStatus: 'Needs Review', handoffFlags: 1 });
    expect(scorecard([signal, { ...signal, issueId: 'issue1', priorInspectionId: 'i2', flaggedByInspectionId: 'next2' }])).toMatchObject({ score: 65, bonusStatus: 'Ineligible', handoffFlags: 2 });
    expect(buildOperatorScorecards(users, paired.slice(0, 8), discoveries, []).find(s => s.user.id === 'reporter')!.bonusStatus).toBe('Needs Review');
  });
});

describe('turnover custody signals', () => {
  it('never reaches past a newer inspection that already reported the defect', () => {
    const rows = [inspection('old', 'prior'), inspection('new', 'prior', { submittedAt: '2026-10-14T08:30:00Z', status: 'issues_found' }), inspection('later', 'reporter', { submittedAt: '2026-10-14T09:00:00Z' })];
    expect(findPossibleMissedIssues([issue('one')], rows)).toHaveLength(0);
  });
  it('ignores self reporting and non-submitted inspections', () => {
    expect(findPossibleMissedIssues([issue('one')], [inspection('self')])).toHaveLength(0);
    expect(findPossibleMissedIssues([issue('one')], [inspection('draft', 'prior', { status: 'in_progress' })])).toHaveLength(0);
  });
  it('can attribute an in-range discovery to a prior inspection outside the date filter', () => {
    const prior = inspection('old', 'prior', { submittedAt: '2026-10-13T17:00:00Z' });
    const signals = findPossibleMissedIssues([issue('one')], [prior, inspection('later')]);
    expect(signals[0].priorInspectionId).toBe('old');
    expect(buildOperatorScorecards(users, [], [], signals).find(s => s.user.id === 'prior')!.handoffFlags).toBe(1);
  });
});
