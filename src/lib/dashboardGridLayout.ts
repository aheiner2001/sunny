import { dashboardLayoutStorageKey, normalizeDashboardLayout, type DashboardWidgetLayout } from './dashboardLayout';

export const GRID_COLUMNS = { desktop: 3, tablet: 2, phone: 1 } as const;
export type GridBreakpoint = keyof typeof GRID_COLUMNS;
export const GRID_WIDGET_META = {
  total_vehicles: { label: 'Total vehicles', minH: 2, defaultH: 3 },
  inspections_today: { label: 'Inspections today', minH: 2, defaultH: 3 },
  open_issue_count: { label: 'Open issues', minH: 2, defaultH: 3 },
  vehicles_in_use_count: { label: 'Vehicles in use count', minH: 2, defaultH: 3 },
  equipment_due_count: { label: 'Equipment due', minH: 2, defaultH: 3 },
  today_issues: { label: "Today's issues", minH: 3, defaultH: 6 },
  open_issues: { label: 'Open issues list', minH: 3, defaultH: 6 },
  in_use: { label: 'Vehicles in use', minH: 4, defaultH: 8 },
  recent_inspections: { label: 'Recent inspections', minH: 3, defaultH: 6 },
  activity: { label: "Today's activity", minH: 3, defaultH: 6 },
  calendar: { label: 'Calendar', minH: 5, defaultH: 7 },
  lifespan: { label: 'Equipment due for review', minH: 3, defaultH: 6 },
  safety: { label: 'Van needs', minH: 3, defaultH: 6 },
} as const;
export type GridWidgetId = keyof typeof GRID_WIDGET_META;
export type GridWidgetPosition = { i: GridWidgetId; x: number; y: number; w: number; h: number };
export const DASHBOARD_CARD_COLORS = ['white','mist','ivory','slate','coral'] as const;
export type DashboardCardColor = typeof DASHBOARD_CARD_COLORS[number] | `#${string}`;
const CARD_HEX: Record<typeof DASHBOARD_CARD_COLORS[number], string> = {
  white: '#ffffff', mist: '#e6fafe', ivory: '#faf7eb', slate: '#edf1f7', coral: '#fee7e9',
};
export function dashboardCardHex(color: DashboardCardColor): string {
  return color.startsWith('#') ? color : CARD_HEX[color as keyof typeof CARD_HEX];
}
export function dashboardCardForeground(color: DashboardCardColor): '#ffffff' | '#0f1724' {
  const hex = dashboardCardHex(color);
  const channels = [1,3,5].map(start => {
    const v = parseInt(hex.slice(start,start+2),16)/255;
    return v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4;
  });
  const luminance = channels[0]*0.2126 + channels[1]*0.7152 + channels[2]*0.0722;
  return luminance > 0.179 ? '#0f1724' : '#ffffff';
}
function validCardColor(value: unknown): value is DashboardCardColor {
  return typeof value === 'string' &&
    (DASHBOARD_CARD_COLORS.some(color => color === value) || /^#[0-9a-fA-F]{6}$/.test(value));
}
export type DashboardGridState = { version: 2; layouts: Record<GridBreakpoint, GridWidgetPosition[]>; hidden: GridWidgetId[]; colors: Partial<Record<GridWidgetId,DashboardCardColor>> };
export const DASHBOARD_GRID_KEY_PREFIX = 'sunny_dashboard_grid_v2_';
const METRICS: GridWidgetId[] = ['total_vehicles','inspections_today','open_issue_count','vehicles_in_use_count','equipment_due_count'];
const ORDER = Object.keys(GRID_WIDGET_META) as GridWidgetId[];
const legacyToIds = (id: string): GridWidgetId[] => id === 'stats' ? METRICS : id === 'in_use' ? ['in_use','recent_inspections'] : id in GRID_WIDGET_META ? [id as GridWidgetId] : [];
const intersects = (a: GridWidgetPosition,b: GridWidgetPosition) => a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
function pack(list: GridWidgetPosition[], columns: number): GridWidgetPosition[] {
  const placed: GridWidgetPosition[]=[];
  for (const item of list) {
    let next={...item};
    while (placed.some(other=>intersects(other,next))) {
      next.y++;
      if (next.y > 10000) break;
    }
    placed.push(next);
  }
  return placed;
}
function validNumber(value: unknown, fallback: number) {
  return typeof value==='number' && Number.isFinite(value) ? Math.floor(value) : fallback;
}
export function normalizeGridLayout(value: unknown, breakpoint: GridBreakpoint): GridWidgetPosition[] {
  const columns=GRID_COLUMNS[breakpoint];
  const seen=new Set<string>();
  const entries: GridWidgetPosition[]=[];
  if (Array.isArray(value)) for (const raw of value) {
    if (!raw || typeof raw.i!=='string' || !(raw.i in GRID_WIDGET_META) || seen.has(raw.i)) continue;
    const i=raw.i as GridWidgetId, meta=GRID_WIDGET_META[i];
    const w=Math.max(1,Math.min(columns,validNumber(raw.w,1)));
    const h=Math.max(meta.minH,Math.min(30,validNumber(raw.h,meta.defaultH)));
    entries.push({i,x:Math.max(0,Math.min(columns-w,validNumber(raw.x,0))),y:Math.max(0,validNumber(raw.y,0)),w,h});
    seen.add(i);
  }
  let lastY=entries.reduce((max,item)=>Math.max(max,item.y+item.h),0);
  for (const i of ORDER) if (!seen.has(i)) {
    entries.push({i,x:0,y:lastY,w:1,h:GRID_WIDGET_META[i].defaultH});
    lastY+=GRID_WIDGET_META[i].defaultH;
  }
  return pack(entries,columns);
}
export function migrateDashboardLayout(legacy: unknown): DashboardGridState {
  const old=normalizeDashboardLayout(legacy as DashboardWidgetLayout[]);
  const ordered=old.flatMap(entry=>legacyToIds(entry.id).map(i=>({i,wide:entry.size==='wide' && entry.id!=='stats'})));
  const layouts={} as DashboardGridState['layouts'];
  for (const bp of Object.keys(GRID_COLUMNS) as GridBreakpoint[]) {
    const columns=GRID_COLUMNS[bp];
    let x=0,y=0,rowH=0;
    const entries=ordered.map(({i,wide})=>{
      const w=wide?columns:1;
      if (x+w>columns) {y+=rowH;x=0;rowH=0;}
      const entry={i,x,y,w,h:GRID_WIDGET_META[i].defaultH};
      x+=w;rowH=Math.max(rowH,entry.h);
      if (x===columns) {x=0;y+=rowH;rowH=0;}
      return entry;
    });
    layouts[bp]=normalizeGridLayout(entries,bp);
  }
  return {version:2,layouts,hidden:[],colors:{}};
}
export function defaultDashboardGrid(): DashboardGridState {
  return migrateDashboardLayout(null);
}
function normalizedState(raw: unknown): DashboardGridState | null {
  if (!raw || typeof raw!=='object' || (raw as any).version!==2 || !(raw as any).layouts || typeof (raw as any).layouts!=='object') return null;
  const layouts=(raw as any).layouts;
  const hidden = Array.isArray((raw as any).hidden)
    ? Array.from(new Set<GridWidgetId>((raw as any).hidden.filter((id: unknown): id is GridWidgetId => typeof id === 'string' && id in GRID_WIDGET_META)))
    : [];
  const rawColors=(raw as any).colors;
  const colors={} as DashboardGridState['colors'];
  if (rawColors && typeof rawColors==='object' && !Array.isArray(rawColors)) {
    for (const id of Object.keys(GRID_WIDGET_META) as GridWidgetId[]) {
      if (validCardColor(rawColors[id])) colors[id]=rawColors[id].startsWith('#') ? rawColors[id].toLowerCase() as DashboardCardColor : rawColors[id];
    }
  }
  return {version:2,layouts:{desktop:normalizeGridLayout(layouts.desktop,'desktop'),tablet:normalizeGridLayout(layouts.tablet,'tablet'),phone:normalizeGridLayout(layouts.phone,'phone')},hidden,colors};
}
export function loadDashboardGrid(userId: string): DashboardGridState {
  if (!userId || typeof localStorage==='undefined') return defaultDashboardGrid();
  try {
    const saved=localStorage.getItem(DASHBOARD_GRID_KEY_PREFIX+userId);
    if (saved) return normalizedState(JSON.parse(saved)) ?? defaultDashboardGrid();
    const legacy=localStorage.getItem(dashboardLayoutStorageKey(userId));
    return legacy ? migrateDashboardLayout(JSON.parse(legacy)) : defaultDashboardGrid();
  } catch {return defaultDashboardGrid();}
}
export function saveDashboardGrid(userId: string,state: DashboardGridState): boolean {
  if (!userId || typeof localStorage==='undefined') return false;
  try {
    const normalized=normalizedState(state);
    if (!normalized) return false;
    localStorage.setItem(DASHBOARD_GRID_KEY_PREFIX+userId,JSON.stringify(normalized));
    return true;
  } catch {return false;}
}
export function resetDashboardGrid(userId: string): DashboardGridState {
  const state=defaultDashboardGrid();
  saveDashboardGrid(userId,state);
  return state;
}
export function mergeVisibleGridLayout(state: DashboardGridState,bp: GridBreakpoint,visible: GridWidgetPosition[]): DashboardGridState {
  const visibleIds=new Set(visible.map(entry=>entry.i));
  const hidden=state.layouts[bp].filter(entry=>!visibleIds.has(entry.i));
  const merged=normalizeGridLayout([...visible,...hidden],bp);
  return {...state,layouts:{...state.layouts,[bp]:merged}};
}
export function setDashboardWidgetVisibility(state: DashboardGridState,id: GridWidgetId,visible: boolean): DashboardGridState {
  return {...state,hidden:visible ? state.hidden.filter(item=>item!==id) : Array.from(new Set([...state.hidden,id]))};
}
export function setDashboardCardColor(state: DashboardGridState,id: GridWidgetId,color: DashboardCardColor): DashboardGridState {
  return {...state,colors:{...state.colors,[id]:color}};
}
