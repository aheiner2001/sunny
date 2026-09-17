/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
  answerIndicatesIssue,
  buildEquipmentFlagPayload,
  getBinaryButtonLabels,
  getUnansweredQuestions,
  isAnswerComplete,
  listDistinctEquipmentFamilies,
  listVehicleEquipmentForFamily,
  resolveVehicleEquipmentForFamily,
  shouldShowPhotoCapture,
} from '@/lib/checklistPairing';
import type { ChecklistQuestion, Equipment } from '@/types';

const q = (overrides: Partial<ChecklistQuestion>): ChecklistQuestion => ({
  id: 'q1',
  category: 'equipment',
  text: 'Sample',
  type: 'yes_no',
  required: true,
  order: 1,
  ...overrides,
});

const eq = (overrides: Partial<Equipment>): Equipment => ({
  id: 'eq-1',
  name: 'Pressure Washer #1',
  toolFamily: 'Pressure Washer',
  category: 'equipment',
  status: 'working',
  ...overrides,
});

describe('checklistPairing button labels', () => {
  it('maps yes_no to Yes/No', () => {
    expect(getBinaryButtonLabels('yes_no')).toMatchObject({
      positive: 'Yes',
      negative: 'No',
      positiveValue: 'yes',
      negativeValue: 'no',
    });
  });

  it('maps pass_fail to Pass/Fail', () => {
    expect(getBinaryButtonLabels('pass_fail')).toMatchObject({
      positive: 'Pass',
      negative: 'Fail',
    });
  });

  it('maps equipment_check and equipment_status to Working / Flag Issue', () => {
    expect(getBinaryButtonLabels('equipment_check')).toMatchObject({
      positive: 'Working',
      negative: 'Flag Issue',
      positiveValue: 'working',
      negativeValue: 'flagged',
    });
    expect(getBinaryButtonLabels('equipment_status').positive).toBe('Working');
  });
});

describe('checklistPairing flagCondition', () => {
  it('defaults on_no: No/Fail open the issue path', () => {
    expect(answerIndicatesIssue(q({ type: 'yes_no' }), 'no')).toBe(true);
    expect(answerIndicatesIssue(q({ type: 'yes_no' }), 'yes')).toBe(false);
    expect(answerIndicatesIssue(q({ type: 'pass_fail' }), 'fail')).toBe(true);
    expect(answerIndicatesIssue(q({ type: 'pass_fail' }), 'pass')).toBe(false);
  });

  it('on_yes: Yes/Pass open the issue path', () => {
    const onYes = q({ type: 'yes_no', flagCondition: 'on_yes' });
    expect(answerIndicatesIssue(onYes, 'yes')).toBe(true);
    expect(answerIndicatesIssue(onYes, 'no')).toBe(false);
  });

  it('never: never opens the issue path from binary answers', () => {
    const never = q({ type: 'yes_no', flagCondition: 'never' });
    expect(answerIndicatesIssue(never, 'no')).toBe(false);
    expect(answerIndicatesIssue(never, 'yes')).toBe(false);
  });

  it('equipment Flag Issue always indicates an issue; checkbox never does', () => {
    expect(answerIndicatesIssue(q({ type: 'equipment_check' }), 'flagged')).toBe(true);
    expect(answerIndicatesIssue(q({ type: 'equipment_check' }), 'working')).toBe(false);
    expect(answerIndicatesIssue(q({ type: 'checkbox' }), 'checked')).toBe(false);
  });
});

describe('checklistPairing photos + unanswered', () => {
  it('hides photo UI unless photoRequirement is required', () => {
    expect(shouldShowPhotoCapture(q({ photoRequirement: 'optional' }))).toBe(false);
    expect(shouldShowPhotoCapture(q({ photoRequirement: 'none' }))).toBe(false);
    expect(shouldShowPhotoCapture(q({ photoRequirement: 'required' }))).toBe(true);
    expect(shouldShowPhotoCapture(q({ type: 'photo' }))).toBe(true);
  });

  it('optional photo allows submit without photoUrl; required enforces photo', () => {
    const optional = q({ type: 'yes_no', photoRequirement: 'optional' });
    expect(isAnswerComplete(optional, { value: 'yes' })).toBe(true);

    const requiredPhoto = q({ type: 'yes_no', photoRequirement: 'required' });
    expect(isAnswerComplete(requiredPhoto, { value: 'yes' })).toBe(false);
    expect(
      isAnswerComplete(requiredPhoto, { value: 'yes', photoUrl: 'data:image/jpeg;base64,x' })
    ).toBe(true);
  });

  it('validates equipment_check and checkbox answers', () => {
    expect(isAnswerComplete(q({ type: 'equipment_check' }), { value: 'working' })).toBe(true);
    expect(isAnswerComplete(q({ type: 'equipment_check' }), {})).toBe(false);
    expect(isAnswerComplete(q({ type: 'checkbox' }), { value: 'checked' })).toBe(true);
    expect(isAnswerComplete(q({ type: 'checkbox' }), { value: '' })).toBe(false);
  });

  it('lists unanswered required questions for Take me to unanswered', () => {
    const questions = [
      q({ id: 'a', text: 'A', type: 'yes_no' }),
      q({ id: 'b', text: 'B', type: 'checkbox' }),
      q({ id: 'c', text: 'C', required: false, type: 'yes_no' }),
    ];
    const unanswered = getUnansweredQuestions(questions, {
      a: { value: 'yes' },
      b: { value: '' },
    });
    expect(unanswered.map(x => x.id)).toEqual(['b']);
  });
});

describe('checklistPairing equipment family resolution + flagging', () => {
  it('lists distinct tool families from inventory', () => {
    const families = listDistinctEquipmentFamilies([
      eq({ id: '1', name: 'Pressure Washer #1', toolFamily: 'Pressure Washer' }),
      eq({ id: '2', name: 'Pressure Washer #2', toolFamily: 'Pressure Washer' }),
      eq({ id: '3', name: 'Air Compressor #1', toolFamily: 'Air Compressor' }),
    ]);
    expect(families.map(f => f.label).sort()).toEqual(['Air Compressor', 'Pressure Washer']);
  });

  it('resolves the van assigned unit for a family (not a specific unit id in settings)', () => {
    const inventory = [
      eq({
        id: 'pw-van1',
        name: 'Pressure Washer #1',
        toolFamily: 'Pressure Washer',
        assignments: [{ vehicleId: 'van-1', vehicleNumber: 'Van 1', quantity: 1 }],
      }),
      eq({
        id: 'pw-van2',
        name: 'Pressure Washer #2',
        toolFamily: 'Pressure Washer',
        assignments: [{ vehicleId: 'van-2', vehicleNumber: 'Van 2', quantity: 1 }],
      }),
      eq({
        id: 'ac-van1',
        name: 'Air Compressor #1',
        toolFamily: 'Air Compressor',
        vehicleId: 'van-1',
        vehicleNumber: 'Van 1',
      }),
    ];
    const resolved = resolveVehicleEquipmentForFamily(inventory, 'van-1', 'Pressure Washer');
    expect(resolved?.id).toBe('pw-van1');
  });

  it('buildEquipmentFlagPayload sets flagged status and links equipmentId for issue/response', () => {
    const inventory = [
      eq({
        id: 'pw-van1',
        name: 'Pressure Washer #1',
        toolFamily: 'Pressure Washer',
        vehicleId: 'van-1',
      }),
    ];
    const payload = buildEquipmentFlagPayload(
      q({
        type: 'equipment_check',
        equipmentFamily: 'Pressure Washer',
        text: 'Pressure washer working?',
      }),
      'flagged',
      inventory,
      'van-1'
    );
    expect(payload).toEqual({
      equipmentId: 'pw-van1',
      equipmentName: 'Pressure Washer #1',
      status: 'flagged',
    });
  });
});

describe('listVehicleEquipmentForFamily', () => {
  const fleet = [
    eq({
      id: 'a1',
      name: 'Air Compressor #1',
      toolFamily: 'Air Compressor',
      vehicleId: 'van-1',
    }),
    eq({
      id: 'a2',
      name: 'Air Compressor #2',
      toolFamily: 'Air Compressor',
      vehicleId: 'van-1',
    }),
    eq({
      id: 'a3',
      name: 'Air Compressor #3',
      toolFamily: 'Air Compressor',
      vehicleId: 'van-2',
    }),
    eq({
      id: 'pw',
      name: 'Pressure Washer #1',
      toolFamily: 'Pressure Washer',
      vehicleId: 'van-1',
    }),
  ];

  it('returns all matching units on the van', () => {
    expect(
      listVehicleEquipmentForFamily(fleet, 'van-1', 'Air Compressor')
        .map(e => e.id)
        .sort()
    ).toEqual(['a1', 'a2']);
  });

  it('returns empty when van has none', () => {
    expect(listVehicleEquipmentForFamily(fleet, 'van-2', 'Pressure Washer')).toEqual([]);
  });

  it('returns a single match', () => {
    expect(listVehicleEquipmentForFamily(fleet, 'van-1', 'Pressure Washer').map(e => e.id)).toEqual([
      'pw',
    ]);
  });
});

describe('buildEquipmentFlagPayload for tagged yes_no', () => {
  it('links yes_no with equipmentFamily when one unit on van', () => {
    const fleet = [
      eq({
        id: 'a1',
        name: 'Air Compressor #1',
        toolFamily: 'Air Compressor',
        vehicleId: 'van-1',
      }),
    ];
    const payload = buildEquipmentFlagPayload(
      q({ type: 'yes_no', flagCondition: 'on_no', equipmentFamily: 'Air Compressor' }),
      'no',
      fleet,
      'van-1'
    );
    expect(payload).toEqual({
      equipmentId: 'a1',
      equipmentName: 'Air Compressor #1',
      status: 'flagged',
    });
  });

  it('returns null when zero matches (caller still creates issue without id)', () => {
    const payload = buildEquipmentFlagPayload(
      q({ type: 'yes_no', flagCondition: 'on_no', equipmentFamily: 'Air Compressor' }),
      'no',
      [],
      'van-1'
    );
    expect(payload).toBeNull();
  });

  it('returns null when two+ matches so UI can force a pick', () => {
    const fleet = [
      eq({
        id: 'a1',
        name: 'Air Compressor #1',
        toolFamily: 'Air Compressor',
        vehicleId: 'van-1',
      }),
      eq({
        id: 'a2',
        name: 'Air Compressor #2',
        toolFamily: 'Air Compressor',
        vehicleId: 'van-1',
      }),
    ];
    const payload = buildEquipmentFlagPayload(
      q({ type: 'yes_no', flagCondition: 'on_no', equipmentFamily: 'Air Compressor' }),
      'no',
      fleet,
      'van-1'
    );
    expect(payload).toBeNull();
  });
});
