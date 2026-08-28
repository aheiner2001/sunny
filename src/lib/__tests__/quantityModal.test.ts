import { describe, it, expect } from 'vitest';
import { parseQuantityInput } from '@/lib/quantityModal';

describe('parseQuantityInput', () => {
  it('rejects blank string', () => {
    expect(parseQuantityInput('')).toEqual({ ok: false, error: expect.any(String) });
    expect(parseQuantityInput('   ')).toEqual({ ok: false, error: expect.any(String) });
  });

  it('accepts valid whole numbers', () => {
    expect(parseQuantityInput('5')).toEqual({ ok: true, value: 5 });
    expect(parseQuantityInput('0')).toEqual({ ok: true, value: 0 });
  });

  it('rejects non-integers', () => {
    expect(parseQuantityInput('1.5').ok).toBe(false);
    expect(parseQuantityInput('abc').ok).toBe(false);
  });
});
