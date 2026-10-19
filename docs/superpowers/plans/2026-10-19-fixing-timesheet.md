# Timesheet reliability implementation

Scope: preserve printed QR URLs; automatically punch employees on inspection entry; never punch a manager merely browsing an inspection. Persist cloud punches atomically before confirming success. Read guards from Firestore so a second browser can return a vehicle. Show actual sync status/errors and keep vehicle returns distinct from timesheet failures. Do not infer or fabricate missing historical hours, change production security rules, or merge main.

1. Add failing regression tests for direct QR entry, scanner modal, rejected writes, remote clock-out, duplicate scans and return retries. Run and observe failures.
2. Implement shared employee entry helper and transactional guard/shift/audit punches. Keep local-only unit-test behavior. Add actionable error/retry UI and truthful snapshot status. Handle empty snapshots and listener recovery.
3. Stabilize existing date-dependent timesheet fixtures; run focused tests, full suite, TypeScript, lint and build. Review whole diff; fix significant findings with regression tests. Push fixing-timesheet and open a PR for user review.

Review focus: manager attribution; returning past missed checklists must not end today's shift; transaction retries must have no local side effects; failed commits must not create confirmed shifts; duplicate events must not end a later shift; no live Firebase writes from tests.

## Progress
- Branch created from main cdc28f5. Existing review-only diagnostics replaced by behavioral regression tests.
