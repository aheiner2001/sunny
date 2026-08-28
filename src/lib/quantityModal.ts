export function parseQuantityInput(
  raw: string,
  opts?: { min?: number; max?: number },
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Enter a quantity.' };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, error: 'Quantity must be a whole number ≥ 0.' };
  }
  if (opts?.min !== undefined && value < opts.min) {
    return { ok: false, error: `Minimum is ${opts.min}.` };
  }
  if (opts?.max !== undefined && value > opts.max) {
    return { ok: false, error: `Maximum is ${opts.max}.` };
  }
  return { ok: true, value };
}
