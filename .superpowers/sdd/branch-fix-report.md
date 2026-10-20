# October 20 whole-branch fix report

## Status

All Important review findings were addressed in one fix pass on branch `october-20`.

## Implementation

- Manual-end historical recovery now requires exactly one pretrip and zero returns for the same employee, vehicle, and Mountain calendar day.
- Added `isMissingReturnManualEndEligible` and used it in both domain validation and UI control visibility.
- Added domain and UI regressions for ambiguous multiple-pretrip rows.
- Unsaved historical estimate and review statuses now use degraded warning styling.
- Empty cached/waiting manager views now say cloud confirmation is pending and suggest retrying, without claiming cloud sync failed.
- Added testing-guide clarification for historical `attention` evidence versus recovered `pending` timesheets.

## Verification

- Focused regressions (3 files): 35 tests passed.
- Historical recovery and TimesheetsClient coverage (5 files): 48 tests passed.
- IDE lint diagnostics for edited TypeScript/TSX files: no errors.
- `git diff --check`: passed.
- Final `npm test`: 82 files / 624 tests passed.
- The first full-suite attempt could not load 10 UI suites because the temporary Playwright install removed `@testing-library/dom` from `node_modules`; `npm ci` restored the lockfile dependency tree, then the final full suite passed.

## Manager analytics browser check

Command:

`$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; node scripts/check-manager-analytics.mjs --base-url http://127.0.0.1:3100 --serve`

Playwright was initially absent. The first no-save install hit an npm dependency-tree error; retrying with legacy peer-dependency resolution succeeded. The documented full browser command then passed:

- 32 checks
- 36 blocked external requests
- 0 write attempts
- 0 allowed live writes
- 0 unexpected console errors
- 0 page errors
- 0 failures

No analytics CSS changes were needed because the script reported no overflow failure.

## Commits

- `29a32de` — `fix(timesheets): tighten recovery and sync states`

Pre-existing uncommitted changes in `.superpowers/sdd/task-2-report.md` and `package-lock.json` were not included in the fix commit.
