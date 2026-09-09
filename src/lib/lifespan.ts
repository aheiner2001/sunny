import { Equipment, LifespanStatus, LifespanLogEntry } from '@/types';

/**
 * Display name for one physical lifespan-tracked unit in a batch.
 * Example: ("Brushy", 2, 3) → "Brushy #2"
 */
export function formatIndividualToolName(baseName: string, index: number, total: number): string {
  const name = (baseName || '').trim() || 'Tool';
  if (total <= 1) return name;
  return `${name} #${index}`;
}

/**
 * Lifespan-tracked tools are always individual assets (qty 1).
 */
export function isMultiQtyLifespanItem(equipment: Pick<Equipment, 'lifespanEnabled' | 'totalQuantity' | 'assignments'>): boolean {
  if (!equipment.lifespanEnabled) return false;
  const assigned = (equipment.assignments || []).reduce((sum, a) => sum + a.quantity, 0);
  const total = Math.max(equipment.totalQuantity ?? 1, assigned);
  return total > 1;
}

/**
 * Calculates due date given a start date and number of months.
 */
export function calculateLifespanDueDate(
  lifeStartedAt: string | Date,
  expectedMonths: number
): string {
  const start = typeof lifeStartedAt === 'string' ? new Date(lifeStartedAt) : new Date(lifeStartedAt.getTime());
  if (Number.isNaN(start.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + Math.max(1, Math.floor(expectedMonths)));
    return fallback.toISOString();
  }
  const due = new Date(start.getTime());
  due.setMonth(due.getMonth() + Math.max(1, Math.floor(expectedMonths)));
  return due.toISOString();
}

/**
 * Computes the lifespan status ('ok' | 'getting_low' | 'due_for_review') for an equipment item.
 * Returns null if lifespan is not enabled or if the equipment is retired.
 * Respects custom `lowWearThresholdPercent` (defaults to 80%).
 */
export function computeLifespanStatus(
  equipment: Partial<Equipment>,
  referenceDate?: Date | string
): LifespanStatus | null {
  if (!equipment.lifespanEnabled || equipment.retiredAt) {
    return null;
  }

  const thresholdPercent = equipment.lowWearThresholdPercent ?? 80;
  const warnFraction = Math.max(0.1, Math.min(0.99, (100 - thresholdPercent) / 100));

  if (equipment.lifespanMode === 'usage') {
    const expectedCars = Number(equipment.expectedCars) || 0;
    const carsUsed = Math.max(0, Number(equipment.carsUsed) || 0);
    const remaining = Math.max(0, expectedCars - carsUsed);

    if (expectedCars <= 0 || carsUsed >= expectedCars) {
      return 'due_for_review';
    }
    if (remaining <= warnFraction * expectedCars && remaining > 0) {
      return 'getting_low';
    }
    return 'ok';
  }

  if (equipment.lifespanMode === 'time') {
    let dueDateIso = equipment.dueDate;
    if (!dueDateIso && equipment.lifeStartedAt && equipment.expectedMonths) {
      dueDateIso = calculateLifespanDueDate(equipment.lifeStartedAt, equipment.expectedMonths);
    }
    if (!dueDateIso) {
      return 'ok';
    }

    const ref = referenceDate
      ? (typeof referenceDate === 'string' ? new Date(referenceDate) : new Date(referenceDate.getTime()))
      : new Date();
    const due = new Date(dueDateIso);

    if (Number.isNaN(due.getTime()) || Number.isNaN(ref.getTime())) {
      return 'ok';
    }

    // Set to start of day for accurate calendar day comparison
    const refStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();

    const diffMs = dueStart - refStart;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return 'due_for_review';
    }
    const warnDays = equipment.lowWearThresholdPercent !== undefined
      ? Math.max(7, Math.round(((equipment.expectedMonths || 12) * 30) * warnFraction))
      : 30;
    if (diffDays <= warnDays) {
      return 'getting_low';
    }
    return 'ok';
  }

  return 'ok';
}

/**
 * Creates an audit log entry on an equipment record.
 */
export function appendLifespanLog(
  equipment: Equipment,
  action: LifespanLogEntry['action'],
  options?: {
    userId?: string | null;
    userName?: string | null;
    reason?: string;
    previousValues?: LifespanLogEntry['previousValues'];
    newValues?: LifespanLogEntry['newValues'];
  }
): LifespanLogEntry[] {
  const entry: LifespanLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    equipmentId: equipment.id,
    timestamp: new Date().toISOString(),
    userId: options?.userId || null,
    userName: options?.userName || null,
    action,
    previousValues: options?.previousValues,
    newValues: options?.newValues,
    reason: options?.reason,
  };

  const currentHistory = equipment.lifespanHistory || [];
  return [entry, ...currentHistory];
}

/**
 * Extends equipment lifespan by adding cars (usage) or months (time).
 */
export function extendLifespan(
  equipment: Equipment,
  extensionAmount: number,
  meta?: { userId?: string | null; userName?: string | null; reason?: string }
): Equipment {
  const amount = Math.max(1, Math.floor(extensionAmount));
  const updated: Equipment = { ...equipment };

  const prevValues = {
    carsUsed: equipment.carsUsed,
    expectedCars: equipment.expectedCars,
    dueDate: equipment.dueDate,
    lifespanStatus: equipment.lifespanStatus,
  };

  if (equipment.lifespanMode === 'usage') {
    const currentExpected = Number(equipment.expectedCars) || 0;
    updated.expectedCars = currentExpected + amount;
  } else if (equipment.lifespanMode === 'time') {
    const currentDue = equipment.dueDate ? new Date(equipment.dueDate) : new Date();
    if (Number.isNaN(currentDue.getTime())) {
      updated.dueDate = calculateLifespanDueDate(new Date(), amount);
    } else {
      const nextDue = new Date(currentDue.getTime());
      nextDue.setMonth(nextDue.getMonth() + amount);
      updated.dueDate = nextDue.toISOString();
    }
    if (equipment.expectedMonths) {
      updated.expectedMonths = (equipment.expectedMonths || 0) + amount;
    }
  }

  updated.lifespanStatus = computeLifespanStatus(updated);
  updated.updatedAt = new Date().toISOString();

  updated.lifespanHistory = appendLifespanLog(equipment, 'extended', {
    userId: meta?.userId,
    userName: meta?.userName,
    reason: meta?.reason || `Extended by ${amount} ${equipment.lifespanMode === 'usage' ? 'cars' : 'months'}`,
    previousValues: prevValues,
    newValues: {
      carsUsed: updated.carsUsed,
      expectedCars: updated.expectedCars,
      dueDate: updated.dueDate,
      lifespanStatus: updated.lifespanStatus,
    },
  });

  return updated;
}

/**
 * Resets wear for replaced equipment.
 */
export function replaceLifespan(
  equipment: Equipment,
  meta?: { userId?: string | null; userName?: string | null; reason?: string }
): Equipment {
  const nowIso = new Date().toISOString();
  const prevValues = {
    carsUsed: equipment.carsUsed,
    expectedCars: equipment.expectedCars,
    dueDate: equipment.dueDate,
    lifespanStatus: equipment.lifespanStatus,
  };

  const updated: Equipment = {
    ...equipment,
    updatedAt: nowIso
  };

  if (equipment.lifespanMode === 'usage') {
    updated.carsUsed = 0;
  } else if (equipment.lifespanMode === 'time') {
    updated.lifeStartedAt = nowIso;
    const months = Number(equipment.expectedMonths) || 12;
    updated.dueDate = calculateLifespanDueDate(nowIso, months);
  }

  updated.lifespanStatus = computeLifespanStatus(updated);

  updated.lifespanHistory = appendLifespanLog(equipment, 'replaced', {
    userId: meta?.userId,
    userName: meta?.userName,
    reason: meta?.reason || 'Replaced with fresh unit',
    previousValues: prevValues,
    newValues: {
      carsUsed: updated.carsUsed,
      expectedCars: updated.expectedCars,
      dueDate: updated.dueDate,
      lifespanStatus: updated.lifespanStatus,
    },
  });

  return updated;
}

/**
 * Retires an equipment item.
 */
export function retireLifespan(
  equipment: Equipment,
  meta?: { userId?: string | null; userName?: string | null; reason?: string }
): Equipment {
  const nowIso = new Date().toISOString();
  const prevValues = {
    carsUsed: equipment.carsUsed,
    expectedCars: equipment.expectedCars,
    dueDate: equipment.dueDate,
    lifespanStatus: equipment.lifespanStatus,
  };

  const updated: Equipment = {
    ...equipment,
    retiredAt: nowIso,
    lifespanStatus: null,
    updatedAt: nowIso
  };

  updated.lifespanHistory = appendLifespanLog(equipment, 'retired', {
    userId: meta?.userId,
    userName: meta?.userName,
    reason: meta?.reason || 'Retired from active service',
    previousValues: prevValues,
    newValues: {
      retiredAt: nowIso,
      lifespanStatus: null,
    },
  });

  return updated;
}

/**
 * Predictive wear forecasting:
 * Calculates estimated days remaining based on vehicle's average daily job rate.
 */
export function calculateWearForecast(
  equipment: Equipment,
  avgDailyRate: number = 3.5
): {
  daysRemaining: number | null;
  estimatedExpiryDate: string | null;
  forecastText: string;
} {
  if (!equipment.lifespanEnabled || equipment.retiredAt) {
    return { daysRemaining: null, estimatedExpiryDate: null, forecastText: 'Lifespan not enabled' };
  }

  const rate = Math.max(0.5, avgDailyRate);

  if (equipment.lifespanMode === 'usage') {
    const expectedCars = Number(equipment.expectedCars) || 0;
    const carsUsed = Math.max(0, Number(equipment.carsUsed) || 0);
    const remainingCars = Math.max(0, expectedCars - carsUsed);

    if (remainingCars === 0) {
      return {
        daysRemaining: 0,
        estimatedExpiryDate: new Date().toISOString(),
        forecastText: 'Reached wear limit (0 cars remaining)',
      };
    }

    const daysRemaining = Math.ceil(remainingCars / rate);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysRemaining);
    const targetDateStr = targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return {
      daysRemaining,
      estimatedExpiryDate: targetDate.toISOString(),
      forecastText: `At current rate of ${rate.toFixed(1)} cars/day, expires in ~${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} (~${targetDateStr})`,
    };
  }

  if (equipment.lifespanMode === 'time' && equipment.dueDate) {
    const due = new Date(equipment.dueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const dueStr = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return {
      daysRemaining,
      estimatedExpiryDate: equipment.dueDate,
      forecastText: `Time-based: expires in ~${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} (${dueStr})`,
    };
  }

  return { daysRemaining: null, estimatedExpiryDate: null, forecastText: 'No forecast available' };
}
