// prototype/server.mjs
import http from 'node:http';
import { DateTime } from 'luxon';
import { FIXTURE_SHIFTS, FIXTURE_TRAINING_ASSIGNMENTS, TEST_USERS } from './fixtures.mjs';

const TIMEZONE = 'America/Denver';
const PORT = 4000;

const server = http.createServer((req, res) => {
  // Enable CORS for frontend web app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  function sendJson(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  // -------------------------------------------------------------
  // AUTHENTICATION HELPER: "Who are you?"
  // Reads Authorization header: "Bearer <token>"
  // -------------------------------------------------------------
  function authenticate(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { ok: false, status: 401, error: "Missing or malformed Authorization header. Expected 'Bearer <token>'" };
    }

    const token = authHeader.slice(7).trim();
    const user = TEST_USERS.find(u => u.token === token);
    if (!user) {
      return { ok: false, status: 401, error: "Invalid or expired token" };
    }

    return { ok: true, user };
  }

  // =============================================================
  // ROUTE 1: GET /reports/weekly/preview
  // =============================================================
  if (req.method === 'GET' && parsedUrl.pathname === '/reports/weekly/preview') {
    // 1. AuthN Guard
    const authResult = authenticate(req);
    if (!authResult.ok) {
      return sendJson(authResult.status, { error: authResult.error });
    }
    const caller = authResult.user;

    // 2. AuthZ Guard (Manager Only)
    if (caller.role !== 'manager') {
      return sendJson(403, {
        error: `Forbidden: User '${caller.name}' has role '${caller.role}'. Manager permissions required.`,
      });
    }

    // 3. Query Validation
    const weekStartParam = parsedUrl.searchParams.get('weekStart');
    if (!weekStartParam) {
      return sendJson(400, {
        error: "Missing required query parameter 'weekStart'. Example: ?weekStart=2026-11-02",
      });
    }

    const anchorDate = DateTime.fromISO(weekStartParam, { zone: TIMEZONE });
    if (!anchorDate.isValid) {
      return sendJson(400, {
        error: `Invalid date format for 'weekStart': '${weekStartParam}'. Expected format is YYYY-MM-DD.`,
      });
    }

    // 4. Week Boundaries
    const mondayStart = anchorDate.startOf('day').minus({ days: anchorDate.weekday - 1 });
    const sundayEnd = mondayStart.plus({ days: 7 }).minus({ milliseconds: 1 });

    const startUtcMs = mondayStart.toUTC().toMillis();
    const endUtcMs = sundayEnd.toUTC().toMillis();

    // 5. Tally Hours
    let approvedSeconds = 0;
    let pendingSeconds = 0;

    for (const shift of FIXTURE_SHIFTS) {
      if (!shift.endAtUtc) continue;

      const shiftStartMs = new Date(shift.startAtUtc).getTime();
      if (shiftStartMs >= startUtcMs && shiftStartMs <= endUtcMs) {
        const elapsedSeconds = Math.max(0, (new Date(shift.endAtUtc).getTime() - shiftStartMs) / 1000);
        const netSeconds = Math.max(0, elapsedSeconds - (shift.unpaidBreakSeconds || 0));

        if (shift.status === 'approved') {
          approvedSeconds += netSeconds;
        } else if (shift.status === 'pending') {
          pendingSeconds += netSeconds;
        }
      }
    }

    const approvedHours = (approvedSeconds / 3600).toFixed(2);
    const pendingHours = (pendingSeconds / 3600).toFixed(2);

    return sendJson(200, {
      requestedBy: { id: caller.id, name: caller.name, role: caller.role },
      timezone: TIMEZONE,
      weekStart: mondayStart.toISODate(),
      weekEnd: sundayEnd.toISODate(),
      windowDenver: {
        start: mondayStart.toISO(),
        end: sundayEnd.toISO(),
      },
      approvedHours,
      pendingHours,
    });
  }

  // =============================================================
  // ROUTE 2: GET /training/gaps
  // Manager Question: "Who still needs to finish or redo assigned training?"
  // =============================================================
  if (req.method === 'GET' && parsedUrl.pathname === '/training/gaps') {
    // 1. AuthN Guard
    const authResult = authenticate(req);
    if (!authResult.ok) {
      return sendJson(authResult.status, { error: authResult.error });
    }
    const caller = authResult.user;

    // 2. AuthZ Guard (Manager Only)
    if (caller.role !== 'manager') {
      return sendJson(403, {
        error: `Forbidden: User '${caller.name}' has role '${caller.role}'. Manager permissions required.`,
      });
    }

    // 3. Filter Gaps (Exclude 'completed', Keep 'assigned', 'awaiting_trainee', 'overdue', 'needs_retrain')
    const incompleteOrRetrain = FIXTURE_TRAINING_ASSIGNMENTS.filter(
      asg => asg.status !== 'completed'
    );

    // 4. Map to clean manager-focused fields
    const gaps = incompleteOrRetrain.map(asg => {
      let actionNeeded = 'Follow up with employee';
      if (asg.status === 'awaiting_trainee') {
        actionNeeded = 'Trainer signed off; awaiting employee certification in-app';
      } else if (asg.status === 'needs_retrain') {
        actionNeeded = `Retraining required (Inspection miss streak: ${asg.missStreak})`;
      } else if (asg.status === 'assigned') {
        actionNeeded = 'Awaiting initial trainer demonstration & sign-off';
      } else if (asg.status === 'overdue') {
        actionNeeded = 'Overdue: Immediate sign-off required';
      }

      return {
        assignmentId: asg.id,
        employeeId: asg.traineeId,
        employeeName: asg.traineeName,
        trainingItemId: asg.itemId,
        trainingTitle: asg.itemTitle,
        status: asg.status,
        dueAt: asg.dueAt,
        actionNeeded,
      };
    });

    return sendJson(200, {
      totalGaps: gaps.length,
      gaps,
    });
  }

  // Fallback for unmatched routes
  sendJson(404, { error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`Sunny reporting prototype server running at http://localhost:${PORT}`);
});
