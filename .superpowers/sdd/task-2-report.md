# Task 2 Report: Interactive Weekly Learning Runner (`scripts/week.mjs` & `npm run week`)

## Overview
Successfully implemented the interactive weekly learning runner CLI script (`scripts/week.mjs`), registered the `npm run week` convenience script in `package.json`, and verified with end-to-end unit tests using Vitest.

## Changes Completed

1. **Test-Driven Development (TDD)**:
   - Created `scripts/__tests__/weekRunner.test.mjs` asserting CLI behavior:
     - Formatted display of curriculum and tasks for Week 9 with `--no-open` flag.
     - Graceful failure and error exit when an invalid week number is passed.
   - Verified initial failure (`MODULE_NOT_FOUND` for `scripts/week.mjs`).

2. **Runner Implementation (`scripts/week.mjs`)**:
   - Reads target week argument (defaults to Week 9 if unspecified).
   - Validates existence of `courses/cse499/roadmap.json` and requested week ID.
   - Renders formatted dashboard containing planned/logged hours, status, core engineering principles, weekly task checklists, and primary reference links.
   - Handles `--no-open` flag to suppress browser launching (useful in automated tests and CI environments).
   - Dynamically resolves platform browser opener command (`open` on macOS, `start` on Windows, `xdg-open` on Linux) to open interactive lesson HTML files when available.

3. **NPM Script Integration (`package.json`)**:
   - Added `"week": "node scripts/week.mjs"` to `scripts`.

4. **Verification**:
   - Executed `npx vitest run scripts/__tests__/weekRunner.test.mjs`:
     ```
     ✓ scripts/__tests__/weekRunner.test.mjs (2 tests) 80ms
       ✓ Week Runner Script (2)
         ✓ displays curriculum and tasks for week 9 when run via node 41ms
         ✓ fails gracefully when an invalid week number is passed 38ms

      Test Files  1 passed (1)
           Tests  2 passed (2)
     ```
   - Executed full test suite across `courses/` and `scripts/`: 4 tests passed across 2 test files.
   - Tested CLI execution directly with `npm run week -- 9 --no-open`: successfully rendered Week 9 dashboard.

5. **Commit**:
   - Commit: `57586b96dc9dd9a5d2b36cde3f9c52dcdde1a9f3`
   - Message: `feat(cli): add interactive week learning runner script`
   - Files committed:
     - `package.json`
     - `scripts/__tests__/weekRunner.test.mjs`
     - `scripts/week.mjs`
