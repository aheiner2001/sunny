# 0005. Production Lambda Architecture: Weekly Fleet Report

Date: 2026-11-05

## Context
The learner has the full weekly fleet reporting Lambda function in `lamdba/index.mjs` (deployed to AWS) and needs to understand its core structure, data flow, and safety mechanisms without getting lost in its 3,600+ lines.

## Decision / Insights
- **Safety First:** The Lambda is built read-only by design and supports `{"dryRun": true}`, allowing zero-risk inspection of analytics output.
- **Decomposition:**
  1. Secret fetching & Google JWT authentication (`SecretsManagerClient`, `getGoogleToken`).
  2. Parallel retrieval of 5 Firestore collections (`vehicles`, `equipment`, `inspections`, `timesheet_shifts`, `timesheet_corrections`).
  3. Pure analytical computation (`buildAnalytics`) based on Denver timezone boundaries.
  4. Dual-mode output: returns JSON preview if `dryRun`, sends email via SES only if `SEND_ENABLED=true` and `dryRun: false`.
- **Pedagogical approach:** Demystify the 3,600-line file into four digestible modules rather than diving into low-level regex/date utilities all at once.
