import { describe, expect, it } from 'vitest';
import { classifyIssueType } from '@/lib/issueClassification';

describe('classifyIssueType', () => {
  it('detects low stock', () => {
    expect(
      classifyIssueType({
        title: 'Microfiber towels',
        description: 'Only 5 left, need 30',
        questionType: 'pass_fail',
        value: 'fail',
      })
    ).toBe('stock_low_inventory');
  });

  it('detects replacement', () => {
    expect(
      classifyIssueType({
        title: 'Hose',
        description: 'Needs replacement — cracked beyond repair',
      })
    ).toBe('equipment_replacement');
  });

  it('defaults equipment_status fail to needs_repair', () => {
    expect(
      classifyIssueType({
        title: 'Compressor',
        description: 'Not turning on',
        questionType: 'equipment_status',
        value: 'flagged',
      })
    ).toBe('needs_repair');
  });
});
