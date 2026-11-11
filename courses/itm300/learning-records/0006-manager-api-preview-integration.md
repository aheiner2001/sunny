# 0006. Manager API Preview Integration Pattern

Date: 2026-11-05

## Context
The learner wants to adapt the Lambda reporting logic so that a manager can access previews through an HTTP API (API Gateway / Lambda) on demand, view fleet summaries and gaps, and test report generation without triggering scheduled email deliveries.

## Decision / Insights
- **Dual Invocation Support:** The same Lambda handler can support both scheduled EventBridge cron invocations (`event.scheduledTime`) and API Gateway HTTP requests (`event.rawPath` / `event.queryStringParameters`).
- **Enforced Preview Safety:** API Gateway requests default to `dryRun: true` and return HTTP 200 responses with CORS headers, preventing accidental SES email sends while returning full analytics, summary metrics, and setup gaps.
- **Progressive Delivery:** The prototype in `aws-lambda/index.mjs` already implements the lightweight HTTP Gateway wrapper; we will integrate these API Gateway response conventions directly into the reporting handler.
