import { Equipment } from '@/types';

export type EquipmentFamilySummary = {
  unitCount: number;
  owned: number;
  inShop: number;
  assigned: number;
  dueForReview: number;
  gettingLow: number;
  lifespanTracked: boolean;
};

export type EquipmentFamilyGroup = {
  key: string;
  label: string;
  items: Equipment[];
  summary: EquipmentFamilySummary;
};

function assignedQty(eq: Equipment): number {
  return (eq.assignments || []).reduce((sum, a) => sum + a.quantity, 0);
}

function shopQty(eq: Equipment): number {
  return Math.max(0, eq.availableQuantity ?? ((eq.totalQuantity ?? 1) - assignedQty(eq)));
}

function ownedQty(eq: Equipment): number {
  return Math.max(eq.totalQuantity ?? 1, assignedQty(eq) + shopQty(eq));
}

/** Strip trailing " #12" style instance suffixes for family derivation. */
export function stripInstanceSuffix(name: string): string {
  return (name || '').replace(/\s+#\d+$/i, '').trim();
}

export function getEquipmentFamilyKey(equipment: Pick<Equipment, 'name' | 'toolFamily'>): string {
  const raw = (equipment.toolFamily || stripInstanceSuffix(equipment.name) || equipment.name || 'tool').trim();
  return raw.toLowerCase();
}

export function getEquipmentFamilyLabel(equipment: Pick<Equipment, 'name' | 'toolFamily'>): string {
  const fromFamily = (equipment.toolFamily || '').trim();
  if (fromFamily) return fromFamily;
  return stripInstanceSuffix(equipment.name) || equipment.name || 'Tool';
}

export function summarizeEquipmentFamily(items: Equipment[]): EquipmentFamilySummary {
  let owned = 0;
  let inShop = 0;
  let assigned = 0;
  let dueForReview = 0;
  let gettingLow = 0;
  let lifespanTracked = false;

  for (const eq of items) {
    owned += ownedQty(eq);
    inShop += shopQty(eq);
    assigned += assignedQty(eq);
    if (eq.lifespanEnabled) lifespanTracked = true;
    if (eq.lifespanEnabled && !eq.retiredAt && eq.lifespanStatus === 'due_for_review') dueForReview += 1;
    if (eq.lifespanEnabled && !eq.retiredAt && eq.lifespanStatus === 'getting_low') gettingLow += 1;
  }

  return {
    unitCount: items.length,
    owned,
    inShop,
    assigned,
    dueForReview,
    gettingLow,
    lifespanTracked
  };
}

export function groupEquipmentByFamily(items: Equipment[]): EquipmentFamilyGroup[] {
  const map = new Map<string, { label: string; items: Equipment[] }>();

  for (const eq of items) {
    const key = getEquipmentFamilyKey(eq);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(eq);
    } else {
      map.set(key, { label: getEquipmentFamilyLabel(eq), items: [eq] });
    }
  }

  return Array.from(map.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      items: value.items.slice().sort((a, b) => a.name.localeCompare(b.name)),
      summary: summarizeEquipmentFamily(value.items)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
