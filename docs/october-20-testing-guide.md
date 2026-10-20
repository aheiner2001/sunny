# October 20 testing guide

Use this guide after installing dependencies and setting the app's normal environment variables.

## Automated checks

### Smoke test

```powershell
npm test
```

Vitest should finish with every test file and test marked as passed. A final result such as `Test Files  60 passed` and `Tests  430 passed` means the suite is green (the exact counts may grow). Any red failed test, non-zero failure count, or failure stack means the check failed; start with the first stack trace and its referenced test.

### Watch mode

```powershell
npm run test:watch
```

Vitest stays open and reruns affected tests as files change. Press `q` to stop it.

### Coverage (optional)

```powershell
npm run test:coverage
```

This runs the suite once and writes the coverage report. Coverage is diagnostic; a green run still requires every test to pass.

### Types and production build

```powershell
npx tsc --noEmit
npm run build
```

Both commands must exit successfully. TypeScript diagnostics or a failed Next.js page compilation mean the check failed.

## Manager Analytics layout walkthrough

The walkthrough uses synthetic local sample data, blocks external requests and refuses Firestore writes. It requires Playwright (`npm install --no-save playwright` if it is not already available).

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "C:\path\to\chrome.exe"
node scripts/check-manager-analytics.mjs --base-url http://127.0.0.1:3100 --serve
```

The final JSON should show `"passed": true`, zero write attempts, zero unexpected console errors, zero page errors, and no failures. Do not point this synthetic session at a deployed app.

## Firebase Console checklist

This repository uses Firebase anonymous authentication in addition to its app passcode session. The anonymous Firebase UID is not the employee ID, so deployed rules must enforce the project's trusted employee/manager mapping; `request.auth != null` alone does not enforce ownership or manager approval.

1. Open **Firebase Console → Firestore Database → Rules** for the Firebase project configured by the deployed `NEXT_PUBLIC_FIREBASE_*` values.
2. Confirm Authentication's anonymous sign-in method is enabled.
3. Confirm reviewed rules permit the operations below for the appropriate signed-in app users. Keep audit creation append-only and manager review writes role-restricted.

| Collection | Read | Write |
| --- | --- | --- |
| `timesheet_shifts` | yes | yes — authorized create/update |
| `timesheet_guards` | yes | yes — authorized create/update |
| `timesheet_audit` | yes | yes — append-only create |
| `timesheet_corrections` | yes | yes — employee request and authorized manager review |

The app listens to whole collections, and Firestore rules do not filter query results. Rules and app queries must therefore agree on which documents each signed-in user may read. Do not use allow-all rules.

4. In a test environment, confirm clock-in/out can read the receipt, guard and relevant shift and can atomically write the shift, guard and audit.
5. Return to **Timesheets** and select **Retry cloud sync**. The sync banner should recover after all four listeners receive server-confirmed snapshots.

## Short manual spot-check

1. As an employee, open an inspection form. Confirm an active shift appears; if clock-in failed, use its retry control.
2. Complete the current vehicle return. Confirm the shift becomes pending; if clock-out failed, use its retry control.
3. As a manager, open **Timesheets** and confirm the same shift is visible.
4. Open a historical week with a missing return, enter the actual end time, and confirm a pending recovered shift appears.
5. Open **Settings → Manager Analytics** in a phone-width window. Confirm controls do not overlap and the `.page` itself has no horizontal scroll.

## How to know it is wrong

- Vitest shows red output, a failed test file/test, or a failure stack.
- Timesheets keeps a rose sync banner after retrying cloud sync.
- A historical attention item has no control for entering the actual end time.
- Manager Analytics adds a horizontal scrollbar to `.page` or its controls overlap at phone width.
