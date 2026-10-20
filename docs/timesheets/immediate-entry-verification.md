# Immediate inspection entry and timesheet verification

## Required behavior
Vehicle selection, a vehicle QR, and New Inspection must open the checklist without awaiting a timesheet write. There is no Continue to inspection step. Signed-in employees are automatically clocked in in the background at scanner selection and at checklist entry. The transactional guard preserves one active shift. Valid inspection submission remains independent of payroll storage. Successfully submitting the current vehicle return starts clock-out; a past catch-up return or a manager returning someone else's vehicle does not close a personal shift.

## Why the previous changes were insufficient
The scanner still awaited clockInScanEmployee before navigation. A Continue fallback reduced the dead end but retained the dependency and an extra action. This revision removes both. Return handling also updated the separate job count before starting clock-out, allowing a job-count failure to skip time capture. Clock-out now starts immediately after the saved checklist, and the successful return screen does not wait for payroll.

## Ten acceptance checks (target: all ten pass)
1. Quick Select opens the checklist immediately while clock-in remains unresolved.
2. QR selection opens the checklist immediately when clock-in fails.
3. No Continue button or extra payroll confirmation is required.
4. Checklist entry automatically attempts employee clock-in; a true manager browsing is not punched.
5. A valid inspection saves during pending/failed clock-in; required answers/photos/odometer checks still apply.
6. Repeated punches preserve one active shift and its start.
7. A saved current return starts clock-out even if its separate job-count update fails.
8. A slow clock-out does not hide the saved return; failed punches remain retryable.
9. A fresh browser reads the remote guard and closes the same server shift into pending approval, with its audit and guard committed atomically.
10. Sync is not labelled live from cache/pending writes alone; all four server-confirmed listeners are required.

Automated tests use a simulated transactional Firestore store and mocked snapshot metadata. These establish application behavior, not deployed Firebase rule correctness. Live cross-device tests and the actual deployed security rules remain separate acceptance checks. Do not assign an unverified 10/10 reliability score.

## Firebase configuration to inspect
No deployed Firestore rules or firebase.json were present in the inspected repository, and this session has no Firebase Console access. Do not replace production rules with allow-all rules.

- Confirm Authentication > Sign-in method > Anonymous is enabled: src/lib/firebase.ts calls signInAnonymously.
- Confirm the deployed NEXT_PUBLIC_FIREBASE_PROJECT_ID and other Firebase variables point to the intended environment.
- Verify the deployed rules explicitly cover these exact top-level collections:
  - timesheet_shifts: authorized reads, create and update.
  - timesheet_guards: authorized reads, create and update; employee ID is the guard document ID.
  - timesheet_audit: authorized reads and append-only creation. Punch receipts use IDs beginning punch-.
  - timesheet_corrections: authorized reads, employee requests and authorized manager review writes.
- Clock-in/out transactions read the receipt, guard, and relevant shift; they commit shift, guard and audit together. Denial of one operation rejects the punch.
- Current sync subscribes to whole collections. Per-employee rules will require compatible scoped queries and trusted employee/manager identity mapping; Firestore rules do not filter unauthorized results.
- App passcode sessions and Firebase anonymous UID are different identities. Never assume employeeId equals request.auth.uid, and do not claim request.auth != null alone enforces employee ownership or manager approval.
- On permission-denied, inspect the actual rule decision for all transaction documents and all four listeners in a test Firebase project. Do not loosen inspection rules to solve timesheet failures.

## Live smoke test after reviewed deployment
1. Use a test employee and note the checklist entry time.
2. Select a vehicle, complete the form and confirm the inspection exists even if timesheet permissions are temporarily denied in a test environment.
3. With permissions enabled, verify the shift and matching guard/audit in Firestore, not only browser cache.
4. Open a second signed-in browser as that employee; confirm the same shift appears.
5. Submit the current return. Confirm end time, pending status, cleared guard and clock-out audit remotely.
6. Confirm the manager sees the same pending shift. Restore any temporary test denials.
7. Record deployed commit, Firebase project, device/browser, actual error codes and result for each check.

References:
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/security/rules-query
- https://firebase.google.com/docs/auth/web/anonymous-auth

## Test changes
Only scanner tests that explicitly required waiting, a Continue button, or scanner-level clock-in warnings are updated for the newly requested immediate-navigation behavior. Existing inspection validation, clock calculations, return protections and persistence tests remain; new return tests and a cloud contract suite extend them. No assertions are skipped or disabled.
