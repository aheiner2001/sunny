import {
  ChecklistCategoryConfig,
  ChecklistQuestion,
  Equipment,
  EquipmentCategory,
  EquipmentKind,
  EquipmentStatus,
  QuestionType
} from '@/types';

export const QUESTION_TYPES: QuestionType[] = [
  'pass_fail',
  'yes_no',
  'text',
  'equipment_status',
  'checkbox',
  'multiple_choice'
];

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = ['equipment', 'supplies', 'vehicle_condition'];

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  'working',
  'flagged',
  'needs_repair',
  'being_repaired',
  'fixed'
];

/**
 * Copyable prompt for an external LLM. Generated from the real types in
 * `src/types/index.ts` — field names here must stay in step with them, or
 * managers will paste output that the validator has to guess at.
 */
export const AI_IMPORT_PROMPT = `Analyze my text/image instructions and output RAW JSON only (no markdown fences, no commentary) matching this exact schema:

{
  "categories": [
    {
      "id": "string            // lowercase_snake_case, stable, e.g. \\"engine_bay\\"",
      "title": "string          // short display name, e.g. \\"Engine Bay\\"",
      "subtitle": "string       // one-line description of what this section covers",
      "order": 1,
      "iconName": "string|null  // optional lucide-react icon, e.g. \\"Wrench\\""
    }
  ],
  "questions": [
    {
      "id": "string            // stable id, e.g. \\"q-engine-1\\"",
      "category": "string      // MUST equal the id of one of the categories above",
      "text": "string          // the question the employee reads",
      "type": "pass_fail | yes_no | text | equipment_status | checkbox | multiple_choice",
      "required": true,
      "order": 1,
      "helperText": "string|null   // optional guidance shown under the question",
      "equipmentName": "string|null // optional equipment this question inspects",
      "options": ["string"],        // required ONLY for multiple_choice
      "reasonPresets": ["string"]   // optional quick-pick failure reasons
    }
  ],
  "equipment": [
    {
      "id": "string           // stable id, e.g. \\"eq-nozzle\\"",
      "name": "string",
      "category": "equipment | supplies | vehicle_condition",
      "kind": "reusable | consumable",
      "totalQuantity": 1,
      "status": "working | flagged | needs_repair | being_repaired | fixed"
    }
  ]
}

Rules:
- Output only the JSON object. No prose before or after.
- Every "questions[].category" must match a "categories[].id" exactly.
- "order" starts at 1 and increases within each list.
- Use "kind": "consumable" for anything used up (soap, towels, chemicals) and "reusable" for tools and hardware.
- "totalQuantity" is how many the whole fleet owns, not per vehicle.
- Omit any top-level key you have nothing for (e.g. send only "equipment").`;

export interface ImportPayload {
  categories: ChecklistCategoryConfig[];
  questions: ChecklistQuestion[];
  equipment: Array<Partial<Equipment> & { name: string }>;
}

export interface ParseResult {
  ok: boolean;
  errors: string[];
  /** Non-fatal notes: aliases remapped, defaults filled, values coerced. */
  warnings: string[];
  payload: ImportPayload;
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';

/** Reads the first present key, so LLM output using near-miss names still lands. */
function pick(row: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

/** Strips ```json fences that most chat models add despite being told not to. */
function stripFences(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export function parseImportPayload(raw: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const payload: ImportPayload = { categories: [], questions: [], equipment: [] };

  if (!raw.trim()) {
    return { ok: false, errors: ['Paste the JSON returned by the AI first.'], warnings, payload };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err: any) {
    return {
      ok: false,
      errors: [`Not valid JSON: ${err?.message || 'could not parse'}`],
      warnings,
      payload
    };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: ['Top level must be a JSON object with "categories", "questions", and/or "equipment" keys.'],
      warnings,
      payload
    };
  }

  const knownKeys = ['categories', 'questions', 'equipment'];
  if (!knownKeys.some(key => parsed[key] !== undefined)) {
    return {
      ok: false,
      errors: [`Found no usable keys. Expected at least one of: ${knownKeys.join(', ')}.`],
      warnings,
      payload
    };
  }

  // ---- Categories ----
  if (parsed.categories !== undefined) {
    if (!Array.isArray(parsed.categories)) {
      errors.push('"categories" must be an array.');
    } else {
      parsed.categories.forEach((row: any, i: number) => {
        const at = `categories[${i}]`;
        if (!row || typeof row !== 'object') {
          errors.push(`${at} is not an object.`);
          return;
        }
        const title = pick(row, ['title', 'name']);
        if (typeof title !== 'string' || !title.trim()) {
          errors.push(`${at}.title is required.`);
          return;
        }
        if (row.title === undefined && row.name !== undefined) {
          warnings.push(`${at}: used "name" as title.`);
        }
        const subtitle = pick(row, ['subtitle', 'description']) ?? '';
        if (row.subtitle === undefined && row.description !== undefined) {
          warnings.push(`${at}: used "description" as subtitle.`);
        }
        const rawOrder = Number(pick(row, ['order']));
        if (!Number.isFinite(rawOrder)) warnings.push(`${at}: no order, defaulted to ${i + 1}.`);

        payload.categories.push({
          id: String(pick(row, ['id']) ?? slug(title)),
          title: title.trim(),
          subtitle: String(subtitle).trim(),
          order: Number.isFinite(rawOrder) ? rawOrder : i + 1,
          iconName: typeof row.iconName === 'string' ? row.iconName : undefined
        });
      });
    }
  }

  // ---- Questions ----
  if (parsed.questions !== undefined) {
    if (!Array.isArray(parsed.questions)) {
      errors.push('"questions" must be an array.');
    } else {
      parsed.questions.forEach((row: any, i: number) => {
        const at = `questions[${i}]`;
        if (!row || typeof row !== 'object') {
          errors.push(`${at} is not an object.`);
          return;
        }
        const text = pick(row, ['text', 'question', 'label']);
        if (typeof text !== 'string' || !text.trim()) {
          errors.push(`${at}.text is required.`);
          return;
        }

        const category = pick(row, ['category', 'categoryId']);
        if (typeof category !== 'string' || !category.trim()) {
          errors.push(`${at}.category is required and must match a category id.`);
          return;
        }
        if (row.category === undefined && row.categoryId !== undefined) {
          warnings.push(`${at}: used "categoryId" as category.`);
        }

        const rawType = pick(row, ['type']);
        let type: QuestionType = 'pass_fail';
        if (rawType === undefined) {
          warnings.push(`${at}: no type, defaulted to pass_fail.`);
        } else if (QUESTION_TYPES.includes(rawType as QuestionType)) {
          type = rawType as QuestionType;
        } else {
          errors.push(`${at}.type "${rawType}" is not one of: ${QUESTION_TYPES.join(', ')}.`);
          return;
        }

        if (type === 'multiple_choice' && !Array.isArray(row.options)) {
          errors.push(`${at}: type multiple_choice requires an "options" array.`);
          return;
        }

        const helperText = pick(row, ['helperText', 'description']);
        if (row.helperText === undefined && row.description !== undefined) {
          warnings.push(`${at}: used "description" as helperText.`);
        }
        const equipmentId = pick(row, ['equipmentId', 'linkedEquipmentId']);
        if (row.equipmentId === undefined && row.linkedEquipmentId !== undefined) {
          warnings.push(`${at}: used "linkedEquipmentId" as equipmentId.`);
        }

        const rawOrder = Number(pick(row, ['order']));
        payload.questions.push({
          id: String(pick(row, ['id']) ?? `q-${slug(text).slice(0, 32)}-${i + 1}`),
          category: category.trim(),
          text: text.trim(),
          type,
          required: typeof row.required === 'boolean' ? row.required : true,
          order: Number.isFinite(rawOrder) ? rawOrder : i + 1,
          equipmentId: equipmentId ? String(equipmentId) : undefined,
          equipmentName: typeof row.equipmentName === 'string' ? row.equipmentName : undefined,
          options: Array.isArray(row.options) ? row.options.map(String) : undefined,
          reasonPresets: Array.isArray(row.reasonPresets) ? row.reasonPresets.map(String) : undefined,
          helperText: helperText ? String(helperText) : undefined
        });
      });
    }
  }

  // ---- Equipment ----
  if (parsed.equipment !== undefined) {
    if (!Array.isArray(parsed.equipment)) {
      errors.push('"equipment" must be an array.');
    } else {
      parsed.equipment.forEach((row: any, i: number) => {
        const at = `equipment[${i}]`;
        if (!row || typeof row !== 'object') {
          errors.push(`${at} is not an object.`);
          return;
        }
        const name = pick(row, ['name', 'title']);
        if (typeof name !== 'string' || !name.trim()) {
          errors.push(`${at}.name is required.`);
          return;
        }

        // Categories arrive title-cased from most models; "safety" has no slot
        // in EquipmentCategory so it folds into equipment, reported below.
        const rawCategory = String(pick(row, ['category']) ?? 'equipment').toLowerCase().trim();
        let category: EquipmentCategory;
        if (EQUIPMENT_CATEGORIES.includes(rawCategory as EquipmentCategory)) {
          category = rawCategory as EquipmentCategory;
        } else if (rawCategory === 'safety' || rawCategory === 'ppe') {
          category = 'equipment';
          warnings.push(`${at}: category "${rawCategory}" mapped to equipment.`);
        } else {
          errors.push(`${at}.category "${rawCategory}" is not one of: ${EQUIPMENT_CATEGORIES.join(', ')}.`);
          return;
        }

        const rawStatus = String(pick(row, ['status']) ?? 'working').toLowerCase().trim();
        let status: EquipmentStatus;
        if (EQUIPMENT_STATUSES.includes(rawStatus as EquipmentStatus)) {
          status = rawStatus as EquipmentStatus;
        } else if (rawStatus === 'available' || rawStatus === 'ok') {
          status = 'working';
          warnings.push(`${at}: status "${rawStatus}" mapped to working.`);
        } else if (rawStatus === 'missing' || rawStatus === 'lost') {
          status = 'flagged';
          warnings.push(`${at}: status "${rawStatus}" mapped to flagged.`);
        } else {
          errors.push(`${at}.status "${rawStatus}" is not one of: ${EQUIPMENT_STATUSES.join(', ')}.`);
          return;
        }

        const rawQty = Number(pick(row, ['totalQuantity', 'defaultQuantity', 'quantity']));
        if (row.totalQuantity === undefined && row.defaultQuantity !== undefined) {
          warnings.push(`${at}: used "defaultQuantity" as totalQuantity.`);
        }
        const totalQuantity = Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 1;

        const rawKind = String(pick(row, ['kind']) ?? '').toLowerCase().trim();
        const kind: EquipmentKind =
          rawKind === 'consumable' || rawKind === 'reusable'
            ? (rawKind as EquipmentKind)
            : category === 'supplies'
            ? 'consumable'
            : 'reusable';

        payload.equipment.push({
          id: pick(row, ['id']) ? String(pick(row, ['id'])) : undefined,
          name: name.trim(),
          category,
          kind,
          totalQuantity,
          status
        });
      });
    }
  }

  // Questions pointing at a category that neither the payload nor the existing
  // config provides would render in no section, so surface it as a warning the
  // caller can escalate once it knows the current categories.
  const payloadCategoryIds = new Set(payload.categories.map(c => c.id));
  payload.questions.forEach((q, i) => {
    if (payload.categories.length > 0 && !payloadCategoryIds.has(q.category)) {
      warnings.push(`questions[${i}]: category "${q.category}" is not in the imported categories.`);
    }
  });

  const total = payload.categories.length + payload.questions.length + payload.equipment.length;
  if (total === 0 && errors.length === 0) {
    errors.push('Nothing to import — every list was empty.');
  }

  return { ok: errors.length === 0, errors, warnings, payload };
}
