import type { IssueType } from '@/types';

export function classifyIssueType(input: {
  title: string;
  description: string;
  questionType?: string;
  value?: string;
}): IssueType {
  const text = `${input.title} ${input.description}`.toLowerCase();

  if (
    /low stock|out of stock|inventory|only \d+|need(s)? \d+|short(age)?|ran out|par level/.test(text)
  ) {
    return 'stock_low_inventory';
  }

  if (/replac(e|ement)|buy new|beyond repair/.test(text)) {
    return 'equipment_replacement';
  }

  if (
    input.questionType === 'equipment_status' ||
    /repair|broken|not working|flagged/.test(text)
  ) {
    return 'needs_repair';
  }

  return 'needs_repair';
}
