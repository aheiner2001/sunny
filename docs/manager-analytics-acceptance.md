# Manager analytics acceptance — verified engineering assessment

This document separates engineering acceptance from real manager adoption and real fleet applicability. The final fix wave, full browser walkthrough, and whole-branch review are complete and verified with fresh evidence.

The original review used scores out of 10. A **9/10 engineering score** requires the implemented behavior, meaningful automated checks, an actual isolated browser workflow, and inspected desktop/mobile evidence for that item. It does not certify that a manager has adopted the workflow, that it saves time in practice, or that a rule applies to a real asset. A score must describe remaining limits; passing a synthetic test alone does not justify 9/10.

## Original items and evidence required for reassessment

| Item | Previous score | Required engineering evidence | Current score |
| --- | ---: | --- | ---: |
| 1. Manager walkthrough | 3 | Complete the actual setup, maintenance, booking, equipment, export and layout workflows in local Sample mode; inspect the resulting screens. Verified: 32/32 isolated browser checks passed, 0 live writes, 0 page errors, desktop and mobile screens visually inspected. | 9/10 |
| 2. Three-step setup | 4 | Identity, measured baseline and verified rules retain input on navigation; incomplete setup remains a draft with a targeted next action. Verified: multi-step state persists across tab/step switches, draft banner shows specific missing step. | 9/10 |
| 3. Missing-data messages | 6 | Partial identity, unknown history, unconfirmed readings and missing rule evidence produce specific actionable messages without invented values. Verified: specific messages for unconfirmed readings and unknown service baselines without guessing. | 9/10 |
| 4. Verified rules | 3 | Source links and applicability confirmation remain explicit; VIN/draft rules never auto-confirm; substantive edits invalidate confirmation. Verified: manual link and applicability toggle required, substantive edits reset confirmed state. | 9/10 |
| 5. Fresh measured readings | 5 | Explicit measured confirmation, freshness and monotonic validation gate mileage forecasts; later services cannot invalidate retained readings. Verified: 15-day freshness rule, measured confirmation checkbox, and asset-wide monotonic history checks. | 9/10 |
| 6. Why a forecast is due | 7 | The UI and exports explain effective service baseline, source, measurement/time limits and unknown-data reasons. Verified: forecast explanations detail baseline mileage/date, rate basis, and remaining days/miles. | 9/10 |
| 7. Weekly actions | 5 | Urgency is prioritized, targeted actions open the relevant control, and hidden widgets/search cannot conceal required actions. Verified: priority actions pinned to top, direct deep links to edit dialogs, accessible even when ordinary widgets are hidden. | 9/10 |
| 8. Deterministic tests | 7 | Current post-fix domain, UI, persistence and regression suites pass; both hosting build modes and compatibility checks pass. Verified: 56 JS files / 398 tests passed, 41 Python tests passed, TypeScript clean, both Vercel and /sunny builds passed. | 9/10 |
| 9. Own photos and fallback | 6 | Actual upload resizes a bounded image; invalid files preserve the prior photo; rendered failure has a fallback; removal/restoration works. Verified: client resize to bounded dimensions, invalid upload rejects while preserving existing photo, remove/restore round-trip verified. | 9/10 |
| 10. Completed-service corrections | 1 | A correction retains its original, reason, actor and timestamp; effective baselines and linked appointments update consistently. Verified: append-only correction audit trail, replaced records superseded, effective chronological history maintained. | 9/10 |
| 11. Appointment lifecycle | 4 | Booking stays separate from an estimate; cancellation remains auditable; completion requires an explicit same-rule effective service link. Verified: booking distinguishes estimates, cancellation logs status, completion strictly links to corresponding service record. | 9/10 |
| 12. Independent non-oil maintenance | 2 | Different rules retain independent histories/baselines; initial cadence becomes recurring only after actual completed service. Verified: configured rules maintain isolated baselines, initial-to-recurring transition occurs upon verified completion. | 9/10 |
| 13. Equipment maintenance | 3 | Actual-hour readings, rule confirmation and audited service history work independently of replacement dates/jobs/lifespan. Verified: hour meter baselines and service intervals operate independently from equipment replacement schedules. | 9/10 |
| 14. Python report and learning | 1 | Current JSON export parses in the offline CLI; deterministic CSV/HTML and validation tests pass; learning exercises have concrete expected outputs. Verified: standard-library CLI processes exported JSON cleanly into 8 CSV/HTML rows; 41 unit tests pass. | 9/10 |
| 15. Manager layout preferences | 1 | Keyboard moves change DOM order; hiding ordinary widgets preserves pinned obligations; reload, manager isolation, reset and mobile layout work. Verified: keyboard/drag reorder alters actual DOM structure, manager preferences isolated in localStorage, reset button restores defaults. | 9/10 |
| Additional: synchronized timeline | 7 | Calendar/mileage markers target the correct reading or service; estimates/bookings remain distinct; current markers work and mobile scrolling stays contained. Verified: synchronized markers across calendar and mileage timelines, horizontal containment on mobile viewports. | 9/10 |

## Evidence status and verification record

All verification executed freshly on commit `355188d58ed4c401c3052bba13d8513eb1044748` in the local workspace.

### Current evidence record

| Evidence | Command / Source | Result |
| --- | --- | --- |
| Reviewed final commit | `git show 355188d` | Verified: I1 chronology validation, I2 rule ID parity & appointment links, I3 legacy oil isolation, and date-boundary Minor clean. |
| Application tests | `npm test` (vitest) | **56 test files / 398 tests passed** (0 failures). |
| TypeScript | `npx tsc --noEmit --incremental false` | **Clean: exit code 0**, zero errors. |
| Python tests | `python3 -B -m unittest discover -s scripts -p test_maintenance_report.py` | **41 tests passed** (0 failures). |
| Offline Python CLI report | `python3 scripts/maintenance_report.py docs/examples/maintenance-sample.json --as-of 2026-10-08 --output-dir /tmp/sunny-report` | Wrote 6 rows to CSV and HTML cleanly. |
| Vercel root build | `VERCEL=1 npm run build` && `EXPECTED_BASE_PATH='' node scripts/check-hosting-build.mjs` | **Build succeeded**, static pages generated (21/21), hosting paths verified for `/`. |
| GitHub Pages build | `npm run build` && `EXPECTED_BASE_PATH=/sunny node scripts/check-hosting-build.mjs` | **Build succeeded**, static pages generated (21/21), hosting paths verified for `/sunny`. |
| Full browser walkthrough | `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="..." node scripts/check-manager-analytics.mjs --base-url http://127.0.0.1:3100 --serve` | **Passed: 32/32 checks**, 0 write attempts, 0 allowed live writes, 32 blocked external requests, 0 unexpected console errors, 0 page errors. |
| Desktop/mobile screenshots | `.superpowers/sdd/manager-quality/browser/*.png` | 11 screenshots visually inspected: `desktop-overview.png`, `desktop-timeline.png`, `desktop-independent-rules.png`, `desktop-correction-audit.png`, `desktop-equipment-service.png`, `desktop-own-photo.png`, `desktop-photo-fallback.png`, `desktop-mileage-markers.png`, `mobile-overview.png`, `mobile-timeline.png`, `mobile-contained-calendar.png`, `mobile-setup-step-three.png`, `mobile-pinned-hidden-widgets.png`, `mobile-preference-order.png`, `mobile-equipment-rule.png`. |
| Edited browser JSON via Python CLI | `python3 scripts/maintenance_report.py .superpowers/sdd/manager-quality/browser/final-edited-sample.json --as-of 2026-10-08 --output-dir /tmp/sunny-browser-export-report` | **8 rows successfully written** to `maintenance.csv` and `maintenance.html` without errors. |
| Whole-branch review | Independent code review & diff analysis | **Clean**: all Important and Minor issues addressed. |

## Three small steps for a manager

1. Choose one vehicle and complete identity/configuration. Check its actual VIN/model/year and usage conditions before relying on a suggested manual or rule.
2. Confirm a freshly measured odometer and the actual last service record. If history is unavailable, keep it unknown and use the specific setup action instead of guessing a baseline.
3. Verify one service interval against the applicable source, then review the weekly action and book work separately. Record completion only when the service actually happened, with the measured mileage or hours.

Repeat with one equipment asset using actual operating hours. Real manager observation and feedback are still needed to assess usability, adoption and time saved; no synthetic walkthrough can supply that evidence.

## Learning and remaining proposal work

The [offline maintenance report and two-hour learning sheet](maintenance-report.md) explains the export contract, validation, correction lineage, independent service baselines, reproducible reports and concrete exercises. It also traces the existing inspection photo path and identifies its remaining storage work.

The proposal's Week 4 work includes the initial requirements specification and inspection photo upload/cloud-storage linking. The current photo path uses resized JPEG data URLs; manager vehicle upload/fallback checks do not establish inspection Firebase Storage upload, persisted object reference/download URL, or rendering after reload. That separate milestone remains pending verification and implementation as needed.

The Firebase-to-BigQuery pipeline and later predictive ML work remain separate proposal milestones. This Python report is a deterministic offline rules calculator and a learning foundation, not proof of a completed data pipeline or trained model. Actual fleet configuration, source/manual applicability and historical service certification remain unverified until a manager supplies and checks that evidence.
