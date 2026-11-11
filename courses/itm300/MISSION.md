# Mission: Sunny Fleet Local-First Reporting API & Firebase Auth

## Why
Design and build a local-first HTTP backend service for the Sunny Fleet CSE 499 capstone project to learn professional HTTP API design, secure server-side Firebase authentication and authorization, and domain-driven report generation from operational fleet records without risking production systems.

## Success looks like
- Author and test a standalone local HTTP server handling `GET /reports/weekly/preview?weekStart=YYYY-MM-DD` with Denver timezone boundaries and net shift duration calculations (1.75 hrs approved, 2.00 hrs pending).
- Author and test `GET /training/gaps` filtering incomplete and retrain-required assignments using Sunny's existing dual sign-off logic.
- Implement server-side verification of Firebase ID tokens and enforce role-based access control (manager vs employee) returning proper HTTP 401 and 403 status codes.
- Evaluate AWS HTTP API Gateway / Lambda migration pathways and cost profiles before considering cloud deployment.

## Constraints
- Local-first prototype isolated in `prototype/` (frontend remains a static Next.js export).
- Production collections, scheduled email jobs, and course baseline remain untouched.
- Step-by-step pair programming: learner writes handlers and runs curl; assistant reviews and debugs.
- No AWS deployments without explicit confirmation.

## Out of scope
- Deploying to AWS in early phases.
- Modifying client-side Next.js routes or build scripts.
- Email delivery execution from preview report paths.
