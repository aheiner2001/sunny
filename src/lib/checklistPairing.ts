import type { ChecklistQuestion, Equipment, QuestionType } from '@/types';
import { getEquipmentFamilyKey, getEquipmentFamilyLabel } from '@/lib/equipmentGrouping';

export type FlagCondition = 'on_no' | 'on_yes' | 'never';
export type PhotoRequirement = 'optional' | 'required' | 'none';

export type BinaryButtonLabels = {
  positive: string;
  negative: string;
  positiveValue: string;
  negativeValue: string;
};

/** Labels + stored values for binary checklist buttons (Settings ↔ Inspect/Return). */
export function getBinaryButtonLabels(type: QuestionType | string | undefined): BinaryButtonLabels {
  switch (type) {
    case 'yes_no':
      return { positive: 'Yes', negative: 'No', positiveValue: 'yes', negativeValue: 'no' };
    case 'pass_fail':
      return { positive: 'Pass', negative: 'Fail', positiveValue: 'pass', negativeValue: 'fail' };
    case 'equipment_check':
    case 'equipment_status':
      return {
        positive: 'Working',
        negative: 'Flag Issue',
        positiveValue: 'working',
        negativeValue: 'flagged',
      };
    default:
      return { positive: 'Pass', negative: 'Fail', positiveValue: 'pass', negativeValue: 'fail' };
  }
}

export function resolveFlagCondition(question: {
  flagCondition?: FlagCondition;
  type?: string;
}): FlagCondition {
  return question.flagCondition ?? 'on_no';
}

export function resolvePhotoRequirement(question: {
  photoRequirement?: PhotoRequirement;
  type?: string;
}): PhotoRequirement {
  if (question.type === 'photo') return 'required';
  return question.photoRequirement ?? 'optional';
}

type FlagableQuestion = {
  type: string;
  flagCondition?: FlagCondition;
};

/** True when the chosen answer should open the issue path. Checkbox never flags. */
export function answerIndicatesIssue(question: FlagableQuestion, value: string): boolean {
  if (question.type === 'checkbox' || question.type === 'text' || question.type === 'photo') {
    return false;
  }
  const condition = resolveFlagCondition(question);
  if (condition === 'never') return false;

  const labels = getBinaryButtonLabels(question.type);
  const normalized = String(value || '').toLowerCase();

  if (question.type === 'equipment_check' || question.type === 'equipment_status') {
    return normalized === labels.negativeValue || normalized === 'flagged' || normalized === 'flag';
  }

  if (condition === 'on_yes') {
    return (
      normalized === labels.positiveValue ||
      normalized === 'yes' ||
      normalized === 'pass' ||
      normalized === 'working'
    );
  }

  // on_no (default): No / Fail / Flag Issue
  return (
    normalized === labels.negativeValue ||
    normalized === 'no' ||
    normalized === 'fail' ||
    normalized === 'flagged'
  );
}

/** Show dedicated photo capture UI only when explicitly required (or photo question type). */
export function shouldShowPhotoCapture(question: {
  photoRequirement?: PhotoRequirement;
  type?: string;
}): boolean {
  return resolvePhotoRequirement(question) === 'required';
}

/** Optional notes are never required by default for Fail/No. */
export function isExplanationRequired(_question: {
  photoRequirement?: PhotoRequirement;
  type?: string;
}): boolean {
  return false;
}

type AnswerableQuestion = {
  id: string;
  required?: boolean;
  type?: string;
  photoRequirement?: PhotoRequirement;
};

export function isAnswerComplete(
  question: AnswerableQuestion,
  response?: { value?: string | null; photoUrl?: string | null } | null
): boolean {
  if (question.required === false) return true;
  const photo = response?.photoUrl ?? null;

  if (question.type === 'photo') {
    return Boolean(photo);
  }

  if (resolvePhotoRequirement(question) === 'required') {
    const value = response?.value;
    const hasValue = value !== undefined && value !== null && value !== '';
    return hasValue && Boolean(photo);
  }

  if (question.type === 'checkbox') {
    return response?.value === 'checked';
  }

  const value = response?.value;
  return value !== undefined && value !== null && value !== '';
}

export function getUnansweredQuestions<T extends AnswerableQuestion>(
  questions: T[],
  responses: Record<string, { value?: string | null; photoUrl?: string | null } | undefined>
): T[] {
  return questions.filter(q => q.required !== false && !isAnswerComplete(q, responses[q.id]));
}

export function listDistinctEquipmentFamilies(
  items: Array<Pick<Equipment, 'name' | 'toolFamily'>>
): Array<{ key: string; label: string }> {
  const map = new Map<string, string>();
  for (const eq of items) {
    const key = getEquipmentFamilyKey(eq);
    if (!map.has(key)) map.set(key, getEquipmentFamilyLabel(eq));
  }
  return Array.from(map.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function isAssignedToVehicle(eq: Equipment, vehicleId: string): boolean {
  if (eq.vehicleId === vehicleId) return true;
  return Boolean(eq.assignments?.some(a => a.vehicleId === vehicleId && (a.quantity ?? 0) > 0));
}

/**
 * Resolve the van's assigned unit for a checklist equipment family.
 * Prefers toolFamily match; falls back to equipmentName / stripped name.
 */
export function resolveVehicleEquipmentForFamily(
  equipment: Equipment[],
  vehicleId: string,
  family?: string | null,
  fallbackName?: string | null
): Equipment | undefined {
  const onVan = equipment.filter(eq => isAssignedToVehicle(eq, vehicleId) && !eq.retiredAt);
  const familyKey = (family || '').trim().toLowerCase();
  if (familyKey) {
    const byFamily = onVan.find(eq => getEquipmentFamilyKey(eq) === familyKey);
    if (byFamily) return byFamily;
  }
  const name = (fallbackName || family || '').trim().toLowerCase();
  if (!name) return undefined;
  return (
    onVan.find(eq => eq.name.toLowerCase() === name) ||
    onVan.find(eq => getEquipmentFamilyKey(eq) === name) ||
    onVan.find(eq => eq.name.toLowerCase().includes(name))
  );
}

export type FlaggedEquipmentUpdate = {
  equipmentId: string;
  equipmentName: string;
  status: 'flagged';
};

type EquipmentLinkQuestion = {
  type: string;
  flagCondition?: FlagCondition;
  equipmentFamily?: string;
  equipmentName?: string;
  equipmentId?: string;
  text?: string;
};

/** Build equipment status updates + issue linkage when equipment_check/status is flagged. */
export function buildEquipmentFlagPayload(
  question: EquipmentLinkQuestion,
  value: string,
  equipment: Equipment[],
  vehicleId: string
): FlaggedEquipmentUpdate | null {
  if (question.type !== 'equipment_check' && question.type !== 'equipment_status') {
    return null;
  }
  if (!answerIndicatesIssue(question, value)) return null;

  if (question.equipmentId) {
    const existing = equipment.find(e => e.id === question.equipmentId);
    return {
      equipmentId: question.equipmentId,
      equipmentName: existing?.name || question.equipmentName || question.text || 'Equipment',
      status: 'flagged',
    };
  }

  const resolved = resolveVehicleEquipmentForFamily(
    equipment,
    vehicleId,
    question.equipmentFamily,
    question.equipmentName
  );
  if (!resolved) return null;
  return {
    equipmentId: resolved.id,
    equipmentName: resolved.name,
    status: 'flagged',
  };
}
