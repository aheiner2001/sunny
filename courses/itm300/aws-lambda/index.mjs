// aws-lambda/index.mjs
import { DateTime } from 'luxon';

const TIMEZONE = 'America/Denver';

// Sample fixture data for shifts
const SHIFTS = [
  {
    id: 'shift-1',
    employeeId: 'emp-101',
    employeeName: 'Sarah Connor',
    status: 'approved',
    startAtUtc: '2026-11-02T16:00:00.000Z',
    endAtUtc: '2026-11-02T17:45:00.000Z',
    unpaidBreakSeconds: 0,
  },
  {
    id: 'shift-2',
    employeeId: 'emp-102',
    employeeName: 'John Smith',
    status: 'pending',
    startAtUtc: '2026-11-03T20:00:00.000Z',
    endAtUtc: '2026-11-03T22:00:00.000Z',
    unpaidBreakSeconds: 0,
  },
  {
    id: 'shift-3-outside',
    employeeId: 'emp-101',
    status: 'approved',
    startAtUtc: '2026-10-28T16:00:00.000Z',
    endAtUtc: '2026-10-28T18:00:00.000Z',
    unpaidBreakSeconds: 0,
  }
];

// Sample fixture data for training gaps
const TRAINING_ASSIGNMENTS = [
  {
    id: 'asg-1',
    traineeId: 'emp-102',
    traineeName: 'John Smith',
    itemId: 'item-wash-1',
    itemTitle: 'Commercial Pressure Washer Operation',
    status: 'completed',
    dueAt: '2026-11-01T00:00:00.000Z',
    missStreak: 0,
  },
  {
    id: 'asg-2',
    traineeId: 'emp-104',
    traineeName: 'Alex Rivera',
    itemId: 'item-chem-2',
    itemTitle: 'Chemical Dilution & PPE Safety',
    status: 'awaiting_trainee',
    dueAt: '2026-11-06T00:00:00.000Z',
    missStreak: 0,
  },
  {
    id: 'asg-3',
    traineeId: 'emp-101',
    traineeName: 'Sarah Connor',
    itemId: 'item-ladder-3',
    itemTitle: 'Van Ladder Rack Securement',
    status: 'needs_retrain',
    dueAt: '2026-11-04T00:00:00.000Z',
    missStreak: 3,
  },
];

// Helper to build standardized JSON responses for API Gateway
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify(body, null, 2)
  };
}

export async function handler(event) {
  // Handle HTTP OPTIONS for browser CORS preflight
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') {
    return response(200, { ok: true });
  }

  const path = event.rawPath || event.requestContext?.http?.path || event.path || '';
  const query = event.queryStringParameters || {};
  const headers = event.headers || {};

  // 1. Authentication Check
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return response(401, { error: "Missing or malformed Authorization header. Expected 'Bearer <token>'" });
  }

  const token = authHeader.slice(7).trim();

  // Test token role resolver:
  // (In production, replace this block with: const decoded = await admin.auth().verifyIdToken(token);)
  let callerRole = 'employee';
  if (token === 'token-manager-1' || token.includes('manager')) {
    callerRole = 'manager';
  }

  // 2. Authorization Check (Must be manager)
  if (callerRole !== 'manager') {
    return response(403, { error: "Forbidden: Manager permissions required." });
  }

  // -------------------------------------------------------------
  // ENDPOINT 1: GET /reports/weekly/preview?weekStart=YYYY-MM-DD
  // -------------------------------------------------------------
  if (path.endsWith('/reports/weekly/preview')) {
    const weekStartParam = query.weekStart;
    if (!weekStartParam) {
      return response(400, { error: "Missing required query parameter 'weekStart'. Example: ?weekStart=2026-11-02" });
    }

    const anchorDate = DateTime.fromISO(weekStartParam, { zone: TIMEZONE });
    if (!anchorDate.isValid) {
      return response(400, { error: `Invalid date format: '${weekStartParam}'. Expected YYYY-MM-DD.` });
    }

    const mondayStart = anchorDate.startOf('day').minus({ days: anchorDate.weekday - 1 });
    const sundayEnd = mondayStart.plus({ days: 7 }).minus({ milliseconds: 1 });

    const startUtcMs = mondayStart.toUTC().toMillis();
    const endUtcMs = sundayEnd.toUTC().toMillis();

    let approvedSeconds = 0;
    let pendingSeconds = 0;

    for (const shift of SHIFTS) {
      if (!shift.endAtUtc) continue;
      const shiftStartMs = new Date(shift.startAtUtc).getTime();
      if (shiftStartMs >= startUtcMs && shiftStartMs <= endUtcMs) {
        const elapsed = Math.max(0, (new Date(shift.endAtUtc).getTime() - shiftStartMs) / 1000);
        const net = Math.max(0, elapsed - (shift.unpaidBreakSeconds || 0));
        if (shift.status === 'approved') approvedSeconds += net;
        else if (shift.status === 'pending') pendingSeconds += net;
      }
    }

    return response(200, {
      timezone: TIMEZONE,
      weekStart: mondayStart.toISODate(),
      weekEnd: sundayEnd.toISODate(),
      windowDenver: {
        start: mondayStart.toISO(),
        end: sundayEnd.toISO(),
      },
      approvedHours: (approvedSeconds / 3600).toFixed(2),
      pendingHours: (pendingSeconds / 3600).toFixed(2),
    });
  }

  // -------------------------------------------------------------
  // ENDPOINT 2: GET /training/gaps
  // -------------------------------------------------------------
  if (path.endsWith('/training/gaps')) {
    const gaps = TRAINING_ASSIGNMENTS
      .filter(asg => asg.status !== 'completed')
      .map(asg => {
        let actionNeeded = 'Follow up with employee';
        if (asg.status === 'awaiting_trainee') {
          actionNeeded = 'Trainer signed off; awaiting employee certification in-app';
        } else if (asg.status === 'needs_retrain') {
          actionNeeded = `Retraining required (Inspection miss streak: ${asg.missStreak})`;
        }
        return {
          assignmentId: asg.id,
          employeeId: asg.traineeId,
          employeeName: asg.traineeName,
          trainingTitle: asg.itemTitle,
          status: asg.status,
          dueAt: asg.dueAt,
          actionNeeded,
        };
      });

    return response(200, {
      totalGaps: gaps.length,
      gaps,
    });
  }

  return response(404, { error: `Route not found for path '${path}'` });
}
