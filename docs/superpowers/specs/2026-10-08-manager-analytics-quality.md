# Manager analytics quality acceptance specification

User authorized implementing and reassessing all 15 review items on October 8.
Work stays on a feature branch and a preview, with current ManagerOnly access.
Production QR paths and checkout/assignment behavior must remain compatible.

Acceptance: guided three-step setup (identity, measured baseline, verified rules);
specific missing-field actions; explicit measured mileage confirmation in inspections;
source-linked rules with configuration/conditions applicability; explained forecasts;
prioritized weekly action list; deterministic tests; resized bounded photos and fallback;
append-only service corrections with reason, original, actor and timestamp;
appointments separate from estimates and linked to completed service explicitly;
non-oil rules with independent baselines and initial/recurring cadence;
equipment service history with actual-hour readings independent of replacement lifespan;
reproducible Python sample-data report with validation; per-manager analytics layout
preferences with reset and mobile-safe ordering; synthetic manager browser workflow.

Rules must never be auto-confirmed from a VIN. Unverified supplied JSON is a draft.
No equipment intervals or historical service baselines may be invented. Missing actual
fleet configuration/manual/history blocks actual applicability certification, not coding.
Ratings report test/browser evidence separately from manager adoption and real data.
No live fleet writes during verification; all forms are exercised in isolated sample mode.
Sample edits never call database writes. Shared saves confirm remote write before success.
Each service is its own rule. Existing oil profiles and histories remain supported.
