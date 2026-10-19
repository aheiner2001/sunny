# Timesheet reliability implementation

Scope: preserve printed QR URLs; automatically punch employees on inspection entry; never punch a manager merely browsing an inspection. Persist cloud punches atomically before confirming success. Read guards from Firestore so a second browser can return a vehicle. Show actual sync status/errors and keep vehicle returns distinct from timesheet failures. Do not infer or fabricate missing historical hours, change production security rules, or merge main.

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
- No production Firebase writes or security-rule verification were performed. Existing missing hours require manager-reviewed correction requests; they are not reconstructed automatically.

## Live acceptance check after merge/deployment
1. Sign in as an employee and open an existing printed vehicle QR URL. Complete an inspection. Verify one active timesheet shift appears with its original start time.
2. Scan again through both scanner entry points; verify no duplicate active shift.
3. Return the assigned vehicle from a second browser signed in as the same employee. Verify the same shift becomes pending in the manager's team view.
4. Verify a true manager browsing an inspection or returning another person's vehicle receives no automatic personal punch. An employee with temporary manager permissions still punches their own hours.
5. Test denied Firestore access only in a nonproduction environment. Verify the punch is not reported as successful and retry succeeds after permissions/connectivity are restored. Check read/write permissions on timesheet_shifts, timesheet_guards, timesheet_audit and timesheet_corrections if the cloud reports a permission failure.
