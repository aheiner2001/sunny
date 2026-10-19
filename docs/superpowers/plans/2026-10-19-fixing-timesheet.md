# Timesheet reliability implementation

Scope: preserve printed QR URLs; automatically punch employees on inspection entry; never punch a manager merely browsing an inspection. Persist cloud punches atomically before confirming success. Read guards from Firestore so a second browser can return a vehicle. Show actual sync status/errors and keep vehicle returns distinct from timesheet failures. Historical estimates need explicit manager review; never fabricate missing timestamps, change production security rules, or merge main.

1. Add failing regression tests for direct QR entry, scanner modal, rejected writes, remote clock-out, duplicate scans and return retries. Run and observe failures.
2. Implement shared employee entry helper and transactional guard/shift/audit punches. Keep local-only unit-test behavior. Add actionable error/retry UI and truthful snapshot status. Handle empty snapshots and listener recovery.
3. Stabilize existing date-dependent timesheet fixtures; run focused tests, full suite, TypeScript, lint and build. Review whole diff; fix significant findings with regression tests. Push fixing-timesheet and open a PR for user review.

Review focus: manager attribution; returning past missed checklists must not end today's shift; transaction retries must have no local side effects; failed commits must not create confirmed shifts; duplicate events must not end a later shift; no live Firebase writes from tests.

## Progress
- Branch created from main cdc28f5. Existing review-only diagnostics replaced by behavioral regression tests.
- Initial regression run: all 6 new entry/persistence tests failed against main; core persistence/service tests then passed (33).
- Implemented atomic cloud punches, shared scanner entry and direct inspection entry, retry UI, authoritative server snapshots and recoverable listener/auth failures. Removed the production demo-data insertion button and misleading isolated-environment label.
- Calendar-dependent existing UI tests now use the explicit fixture week rather than the machine's current week. Corrected two stale fixture type errors so TypeScript checking succeeds.
- Whole-branch independent review found three significant issues: return result must use inspection.id; sync readiness must reflect each collection's latest metadata; payroll identity must use the actual account role rather than temporary permissions. Each received a failing regression and fix. Added transaction callback retry/post-callback commit-failure coverage.
- Final verification: 74 test files, 552 tests passing; TypeScript noEmit passes; lint and production static-export build pass with existing repository warnings. git diff --check passes.
- No production Firebase writes or security-rule verification were performed. Existing missing hours require manager review. The historical recovery extension below adds conservative, unapproved estimates from source evidence.

## Live acceptance check after merge/deployment
1. Sign in as an employee and open an existing printed vehicle QR URL. Complete an inspection. Verify one active timesheet shift appears with its original start time.
2. Scan again through both scanner entry points; verify no duplicate active shift.
3. Return the assigned vehicle from a second browser signed in as the same employee. Verify the same shift becomes pending in the manager's team view.
4. Verify a true manager browsing an inspection or returning another person's vehicle receives no automatic personal punch. An employee with temporary manager permissions still punches their own hours.
5. Test denied Firestore access only in a nonproduction environment. Verify the punch is not reported as successful and retry succeeds after permissions/connectivity are restored. Check read/write permissions on timesheet_shifts, timesheet_guards, timesheet_audit and timesheet_corrections if the cloud reports a permission failure.


## Historical recovery extension (approved in conversation)
- Add manager-only Recover historical hours under Team Shifts for the selected week. Navigate weeks to inspect older history. Preview pairs only one employee/vehicle/Mountain calendar day with exactly one eligible pretrip and return. Recorded inspection starts are preferred; submission times are clearly labeled. Durations exclude unpaid breaks.
- Flag missing, multiple, overlapping, overnight, catch-up and manager-submitted evidence for manual investigation. Skip existing shifts and pending hours requests. Preserve source IDs even after manager edits so recovered evidence cannot be imported again.
- Add for review imports only a pending, estimated shift with source provenance and an audit event. Existing edit/approve controls handle verified times and breaks. No personal active shift is opened or closed by recovery.
- Verify source inspections and missed-return provenance against server-confirmed reads when saving; validate selected source documents within the import transaction. New return records also store missedReturnId directly, including when later catch-up bookkeeping fails.
- Manager edits and correction requests now participate in the same per-employee revision lock as punches/recovery. A conflicting mutation between availability queries and commit rejects the stale import. Recovered adjustments/approvals recheck remote overlaps; failed approval leaves local hours unapproved.
- Separate code review completed. Its four significant findings (concurrent edits, stale source evidence, catch-up pairing and edit-path overlap checks) were covered by regression tests and fixed. Previously recovered source IDs remain covered after edits as well.
- Validation: 76 test files / 576 tests pass; production static-export build (including lint and TypeScript checks) passes with existing warnings. Live Firebase security rules and real device flows remain an acceptance check after deployment.

Live recovery check: open Timesheets → Manager Review, choose the historical week, expand Recover historical hours, inspect employee/vehicle/time evidence and before-break duration, then Add for review. Verify the row remains pending, edit actual times/breaks, then explicitly approve. Verify today’s active shift is untouched and the evidence cannot be added a second time. Review flagged source records manually.
