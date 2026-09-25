/** @vitest-environment node */
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultDashboardGrid, loadDashboardGrid, migrateDashboardLayout, normalizeGridLayout, saveDashboardGrid, resetDashboardGrid, GRID_COLUMNS, mergeVisibleGridLayout, setDashboardWidgetVisibility, setDashboardCardColor, dashboardCardHex, dashboardCardForeground } from '@/lib/dashboardGridLayout';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
});
function noOverlaps(items: { x:number;y:number;w:number;h:number }[]) {
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const p=items[a], q=items[b];
    expect(p.x+p.w<=q.x || q.x+q.w<=p.x || p.y+p.h<=q.y || q.y+q.h<=p.y).toBe(true);
  }
}
describe('versioned dashboard layouts', () => {
  it('expands legacy stats into five metrics and packs nonoverlapping cards at each breakpoint', () => {
    const old=[{id:'stats',size:'wide'},{id:'today_issues',size:'medium'},{id:'calendar',size:'wide'}];
    const state=migrateDashboardLayout(old);
    expect(state.layouts.desktop.slice(0,5).map(w=>w.i)).toEqual(['total_vehicles','inspections_today','open_issue_count','vehicles_in_use_count','equipment_due_count']);
    for (const bp of ['desktop','tablet','phone'] as const) {
      expect(state.layouts[bp].length).toBe(13);
      expect(new Set(state.layouts[bp].map(w=>w.i)).size).toBe(13);
      expect(state.layouts[bp].map(w=>w.i)).toContain('recent_inspections');
      expect(state.layouts[bp].every(w=>Number.isInteger(w.x)&&Number.isInteger(w.y)&&w.x>=0&&w.y>=0&&w.w>=1&&w.x+w.w<=GRID_COLUMNS[bp])).toBe(true);
      noOverlaps(state.layouts[bp]);
    }
  });
  it('repairs unknown, duplicate, colliding, invalid and missing rectangles', () => {
    const normalized=normalizeGridLayout([
      {i:'today_issues',x:0,y:0,w:3,h:4},
      {i:'today_issues',x:0,y:0,w:3,h:4},
      {i:'calendar',x:0,y:0,w:3,h:0},
      {i:'activity',x:NaN,y:Infinity,w:2,h:3},
      {i:'unknown',x:0,y:0,w:1,h:3}
    ], 'tablet');
    expect(normalized.length).toBe(13);
    expect(normalized.find(w=>w.i==='today_issues')?.w).toBe(2);
    expect(normalized.find(w=>w.i==='calendar')?.h).toBeGreaterThanOrEqual(5);
    noOverlaps(normalized);
  });
  it('keeps the old key and isolates managers and breakpoints on save, reload and reset', () => {
    store.set('sunny_dashboard_layout_a',JSON.stringify([{id:'calendar',size:'wide'},{id:'stats',size:'small'}]));
    const a=loadDashboardGrid('a');
    expect(a.layouts.desktop[0].i).toBe('calendar');
    expect(store.has('sunny_dashboard_layout_a')).toBe(true);
    const changed={...a, layouts:{...a.layouts,desktop:a.layouts.desktop.map(w=>w.i==='calendar'?{...w,h:12}:w)}};
    expect(saveDashboardGrid('a',changed)).toBe(true);
    expect(loadDashboardGrid('a').layouts.desktop.find(w=>w.i==='calendar')?.h).toBe(12);
    expect(loadDashboardGrid('a').layouts.phone).toEqual(a.layouts.phone);
    expect(loadDashboardGrid('b')).toEqual(defaultDashboardGrid());
    resetDashboardGrid('a');
    expect(loadDashboardGrid('a')).toEqual(defaultDashboardGrid());
    expect(store.has('sunny_dashboard_layout_a')).toBe(true);
  });
  it('preserves hidden widget placement and does not lose other breakpoints when visible widgets move', () => {
    const state=defaultDashboardGrid();
    const hidden=state.layouts.desktop.find(w=>w.i==='lifespan');
    const next=mergeVisibleGridLayout(state,'desktop',state.layouts.desktop.filter(w=>w.i!=='lifespan').map(w=>w.i==='activity'?{...w,x:0,y:99}:w));
    expect(next.layouts.desktop.find(w=>w.i==='lifespan')).toEqual(hidden);
    expect(next.layouts.tablet).toEqual(state.layouts.tablet);
  });
  it('keeps a visible dragged card in place when it lands on a hidden card', () => {
    const state=defaultDashboardGrid();
    const hidden=state.layouts.desktop.find(w=>w.i==='lifespan')!;
    const visible=state.layouts.desktop.filter(w=>w.i!=='lifespan');
    const target=visible.find(w=>w.i==='total_vehicles')!;
    const next=mergeVisibleGridLayout(state,'desktop',visible.map(w=>w.i===target.i?{...w,x:hidden.x,y:hidden.y,w:hidden.w,h:hidden.h}:w));
    expect(next.layouts.desktop.find(w=>w.i===target.i)).toMatchObject({x:hidden.x,y:hidden.y});
    expect(next.layouts.desktop.find(w=>w.i==='lifespan')).toBeDefined();
    noOverlaps(next.layouts.desktop);
  });
  it('falls back for malformed or unavailable storage and reports failed writes', () => {
    store.set('sunny_dashboard_grid_v2_a','{broken');
    expect(loadDashboardGrid('a')).toEqual(defaultDashboardGrid());
    (globalThis as any).localStorage={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
    expect(loadDashboardGrid('a')).toEqual(defaultDashboardGrid());
    expect(saveDashboardGrid('a',defaultDashboardGrid())).toBe(false);
  });

  it('hides a section without losing its placement or changing other accounts', () => {
    const original = defaultDashboardGrid();
    const position = original.layouts.desktop.find(w => w.i === 'recent_inspections');
    const hidden = setDashboardWidgetVisibility(original, 'recent_inspections', false);
    expect(hidden.hidden).toEqual(['recent_inspections']);
    expect(hidden.layouts.desktop.find(w => w.i === 'recent_inspections')).toEqual(position);
    expect(saveDashboardGrid('manager-a', hidden)).toBe(true);
    expect(loadDashboardGrid('manager-a').hidden).toEqual(['recent_inspections']);
    expect(loadDashboardGrid('manager-b').hidden).toEqual([]);
    const shown = setDashboardWidgetVisibility(loadDashboardGrid('manager-a'), 'recent_inspections', true);
    expect(shown.hidden).toEqual([]);
    expect(shown.layouts.desktop.find(w => w.i === 'recent_inspections')).toEqual(position);
  });

  it('ignores unknown or duplicate hidden section names from storage', () => {
    const state = defaultDashboardGrid();
    store.set('sunny_dashboard_grid_v2_a', JSON.stringify({ ...state, hidden: ['calendar','calendar','unknown',7] }));
    expect(loadDashboardGrid('a').hidden).toEqual(['calendar']);
    expect(resetDashboardGrid('a').hidden).toEqual([]);
  });
  it('saves an individual card color per account without changing its position', () => {
    const initial=defaultDashboardGrid();
    expect(initial.colors.calendar).toBeUndefined();
    const changed=setDashboardCardColor(initial,'calendar','slate');
    expect(changed.colors.calendar).toBe('slate');
    expect(changed.layouts).toEqual(initial.layouts);
    expect(saveDashboardGrid('manager-a',changed)).toBe(true);
    expect(loadDashboardGrid('manager-a').colors.calendar).toBe('slate');
    expect(loadDashboardGrid('manager-b').colors.calendar).toBeUndefined();
    expect(resetDashboardGrid('manager-a').colors).toEqual({});
  });
  it('drops unknown card colors and widget IDs from older or malformed settings', () => {
    const initial=defaultDashboardGrid();
    store.set('sunny_dashboard_grid_v2_a',JSON.stringify({...initial,colors:{calendar:'neon',activity:'mist',bogus:'coral'}}));
    expect(loadDashboardGrid('a').colors).toEqual({activity:'mist'});
  });
  it('persists a picked hex color per manager and discards malformed values', () => {
    const changed = setDashboardCardColor(defaultDashboardGrid(), 'calendar', '#123abc');
    expect(saveDashboardGrid('manager-a', changed)).toBe(true);
    expect(loadDashboardGrid('manager-a').colors.calendar).toBe('#123abc');
    expect(loadDashboardGrid('manager-b').colors.calendar).toBeUndefined();
    store.set('sunny_dashboard_grid_v2_manager-a', JSON.stringify({
      ...changed, colors: { calendar: 'red; background: url(x)', activity: '#12345g', safety: '#abcdef' },
    }));
    expect(loadDashboardGrid('manager-a').colors).toEqual({ safety: '#abcdef' });
  });
  it('resolves old presets and chooses readable text for picked colors', () => {
    expect(dashboardCardHex('mist')).toBe('#e6fafe');
    expect(dashboardCardHex('#123abc')).toBe('#123abc');
    expect(dashboardCardForeground('#101019')).toBe('#ffffff');
    expect(dashboardCardForeground('#faf7eb')).toBe('#0f1724');
  });
});
