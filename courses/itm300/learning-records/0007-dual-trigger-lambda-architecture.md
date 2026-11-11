# 0007. Dual-Trigger Lambda Architecture: Cron Dispatch vs. Manager API Preview

Date: 2026-11-05

## Context
The learner wanted reassurance on architectural safety and behavior: Does enabling an API preview break or alter the weekly scheduled SES email service? Can the same Lambda engine serve both scheduled production dispatches and mid-week live manager previews?

## Decision / Insights
- **Dual Ingress ("Two Doors, One Kitchen"):**
  1. **EventBridge Cron:** Triggers once a week on schedule (`dryRun: false`, `mode: "previous"`), generates HTML + CSV attachments, and sends via SES to manager recipients.
  2. **API Gateway HTTP:** Triggers on demand when a manager calls the endpoint (`dryRun: true`, `mode: "current"` or custom date anchor), calculates live metrics against Firestore, and returns HTTP JSON.
- **Fail-safe Safety Invariant:** When invoked via HTTP API, `dryRun` is strictly enforced to `true` to ensure interactive testing and manager dashboard polling never trigger unwanted email deliveries.
- **Pedagogical reinforcement:** Emphasized that zero code duplication is required; both triggers share the same underlying business rule functions (`buildAnalytics`, `renderReport`).
