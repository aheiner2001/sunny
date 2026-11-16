# 📚 Sunny Fleet: Master Learning Hub & Curriculum Index

Welcome to the central learning documentation index for **Sunny Fleet**. This file contains links, descriptions, and viewing instructions for all interactive lessons, runbooks, and engineering learning records across both **CSE 499 (Senior Project)** and **ITM 300 (Cloud Systems)**.

---

## 🧭 Quick Navigation
1. [CSE 499 Senior Project Hub (Weeks 9–13)](#-cse-499-senior-project-curriculum)
   - [Week 9: Automated Cloud CI/CD & Baseline Smoke Test](#week-9-automated-cloud-cicd--baseline-smoke-test-)
   - [Weeks 10–13 Roadmap Preview](#weeks-1013-roadmap-preview)
2. [ITM 300 Cloud Systems & Serverless Architecture Hub](#-itm-300-cloud-systems--serverless-architecture)
   - [Complete Interactive Lessons (18 Lessons)](#interactive-lessons-html)
   - [Engineering Learning Records (Markdown)](#engineering-learning-records-markdown)
3. [How to View Lessons Locally or on GitHub](#-how-to-view-these-lessons)

---

## 🎓 CSE 499 Senior Project Curriculum

Master Roadmap: [`courses/cse499/ROADMAP.md`](courses/cse499/ROADMAP.md)  
Machine-Readable Roadmap: [`courses/cse499/roadmap.json`](courses/cse499/roadmap.json)  
CLI Command: `npm run week <number>` (e.g. `npm run week 9`)

### Week 9: Automated Cloud CI/CD & Baseline Smoke Test ✅
**Status:** Completed & Verified (10/10 planned hours) · Deployed to AWS Lambda Version 2 via GitHub Actions.

| Format | Document | Description |
| :--- | :--- | :--- |
| **Markdown** | [**Week 9 Comprehensive Review**](courses/cse499/learning-records/week-09-comprehensive-review.md) | Complete architectural synthesis of Week 9: problems solved, CI/CD pipeline, Lambda runtime, smoke tests, and verified evidence. |
| **Interactive HTML** | [**Week 9 Visual Review & Knowledge Check**](courses/cse499/lessons/week-09-comprehensive-review.html) | Interactive dashboard with KPIs, live deployment proof, architecture diagrams, and self-assessment quiz. |
| **Interactive HTML** | [**AWS IAM & GitHub Secrets Step-by-Step Runbook**](courses/cse499/lessons/0001-lambda-cicd-oidc.html) | Concrete walkthrough for setting up IAM `AWSLambda_FullAccess`, creating Access Keys, and adding GitHub Secrets. |
| **Markdown** | [**Architecture Decision Record 0001: Lambda CI/CD**](courses/cse499/learning-records/0001-lambda-github-cicd.md) | Why automated CI/CD replaces error-prone AWS Console web editing. |
| **Test Fixtures** | [**Smoke Test Baseline Specification**](courses/cse499/fixtures/smoke-test-entities.json) | Verified test entities (Alicia, Marcus, Elena) and M4 net shift duration (1.75h) in [`smokeTestBaseline.test.ts`](courses/cse499/__tests__/smokeTestBaseline.test.ts). |

### Weeks 10–13 Roadmap Preview

| Week | Planned | Status | Primary Focus | Interactive Lesson |
| :---: | :---: | :---: | :--- | :--- |
| **Week 10** | 14 hrs | ⚪ Planned | **Requirements Acceptance Gate (M1–M6)** & Dual-Theme Switcher (Enterprise vs Nintendo Switch UI) | `courses/cse499/lessons/0002-theme-state-isolation.html` |
| **Week 11** | 12 hrs | ⚪ Planned | **Cloud Security & Stateless Firebase JWT Validation** (Stateless Bearer token auth) | `courses/cse499/lessons/0003-stateless-jwt-auth.html` |
| **Week 12** | 12 hrs | ⚪ Planned | **Scheduled Fleet Reporting & Data Integrity** (Mountain Time boundaries & audit logs) | `courses/cse499/lessons/0004-timezone-reporting-reconciliation.html` |
| **Week 13** | 12 hrs | ⚪ Planned | **Final Demo Rehearsal & Portfolio Packaging** (C4 diagrams, clean-slate demo, video) | `courses/cse499/lessons/0005-portfolio-and-demo.html` |

---

## ☁️ ITM 300 Cloud Systems & Serverless Architecture

Production Lambda Code: [`courses/itm300/aws-lambda/index.mjs`](courses/itm300/aws-lambda/index.mjs)  
API Quick Reference: [`courses/itm300/http-api-cheat-sheet.html`](courses/itm300/http-api-cheat-sheet.html)

### Interactive Lessons (HTML)
Open any of these in your browser or preview on GitHub:

1. [**0001: HTTP Handler Basics**](courses/itm300/lessons/0001-http-handler-basics.html) — Anatomy of an AWS Lambda request and response object.
2. [**0002: Dynamic Calculations and Validation**](courses/itm300/lessons/0002-dynamic-calculations-and-validation.html) — Server-side data integrity vs client-side validation.
3. [**0003: Authentication vs Authorization**](courses/itm300/lessons/0003-authentication-vs-authorization.html) — Verifying identity vs granting permissions.
4. [**0004: Training Gaps & Dual Sign-Off**](courses/itm300/lessons/0004-training-gaps-and-dual-signoff.html) — Employee vs manager safety certification workflow.
5. [**0005: AWS Lambda & API Gateway Architecture**](courses/itm300/lessons/0005-aws-lambda-api-gateway-architecture.html) — Routing internet HTTP traffic to serverless functions.
6. [**0006: Anatomy of the Weekly Fleet Report**](courses/itm300/lessons/0006-anatomy-of-the-weekly-fleet-report-lambda.html) — Deep dive into the core 3,700-line reporting logic.
7. [**0007: Exposing Report Previews via Manager API**](courses/itm300/lessons/0007-exposing-report-previews-via-manager-api.html) — Adding read-only dry-run preview capabilities.
8. [**0008: Dual-Trigger Lambda Architecture**](courses/itm300/lessons/0008-dual-trigger-lambda-architecture.html) — Handling both EventBridge cron jobs and HTTP API requests in one function.
9. [**0009: Connecting UI Button to Lambda API**](courses/itm300/lessons/0009-connecting-the-ui-button-to-lambda-api.html) — Triggering cloud reports from Next.js manager dashboards.
10. [**0010: Where Code Goes in Lambda**](courses/itm300/lessons/0010-where-code-goes-in-lambda.html) — Understanding `/var/task`, handler file locations, and entrypoints.
11. [**0011: Clearing Up Lambda Code Confusion**](courses/itm300/lessons/0011-clearing-up-lambda-code-confusion.html) — Distinguishing Lambda backend handlers from Next.js frontend code.
12. [**0012: API Gateway Setup & UI Integration**](courses/itm300/lessons/0012-api-gateway-setup-and-ui-integration.html) — Step-by-step route and integration configuration.
13. [**0013: What Is a Resource Path?**](courses/itm300/lessons/0013-what-is-a-resource-path.html) — URI path mechanics and query parameter handling.
14. [**0014: Do You Need a Stage?**](courses/itm300/lessons/0014-do-you-need-a-stage.html) — HTTP API auto-deploy `$default` stages vs REST API stages.
15. [**0015: Fixing API Gateway CORS**](courses/itm300/lessons/0015-fixing-api-gateway-cors.html) — Solving cross-origin headers (`OPTIONS` 204 and `Access-Control-Allow-Origin`).
16. [**0016: Why Lambda Backend vs Direct Client Database?**](courses/itm300/lessons/0016-why-lambda-backend-vs-client-database.html) — Protecting private service accounts from client exposure.
17. [**0017: Next Steps & API Expansion**](courses/itm300/lessons/0017-next-steps-and-api-expansion.html) — Scaling endpoints beyond reporting into timesheets and audits.
18. [**0018: Full API Suite Implemented**](courses/itm300/lessons/0018-full-api-suite-implemented.html) — Final summary of all deployed API endpoints and tests.

### Engineering Learning Records (Markdown)
Concise architectural decisions for developers and technical leads:
- [**Record 0001: HTTP Handler Anatomy**](courses/itm300/learning-records/0001-http-handler-anatomy.md)
- [**Record 0002: Timesheet Boundary & Validation**](courses/itm300/learning-records/0002-timesheet-boundary-and-validation.md)
- [**Record 0003: Authentication vs Authorization**](courses/itm300/learning-records/0003-authentication-vs-authorization.md)
- [**Record 0004: Training Gaps & Manager Intelligence**](courses/itm300/learning-records/0004-training-gaps-and-manager-intelligence.md)
- [**Record 0005: Production Lambda Architecture**](courses/itm300/learning-records/0005-production-lambda-architecture.md)
- [**Record 0006: Manager API Preview Integration**](courses/itm300/learning-records/0006-manager-api-preview-integration.md)
- [**Record 0007: Dual-Trigger Lambda Architecture**](courses/itm300/learning-records/0007-dual-trigger-lambda-architecture.md)

---

## 💻 How to View These Lessons

### 1. View Directly on GitHub
- Click any `.md` markdown link above to read formatted documents directly in GitHub.
- For `.html` lessons on GitHub, open the file and click **"Raw"**, or copy the URL into [htmlpreview.github.io](https://htmlpreview.github.io).

### 2. View Locally in Your Browser
You can launch any lesson directly from your terminal:

```bash
# Open the Week 9 Comprehensive Review:
open courses/cse499/lessons/week-09-comprehensive-review.html

# Or use the week CLI tool:
npm run week 9

# Open any ITM 300 lesson:
open courses/itm300/lessons/0001-http-handler-basics.html
open courses/itm300/http-api-cheat-sheet.html
```

---

## 🛠️ Essential Verification Commands

```bash
# Run all 104 test suites (719 tests):
npm test

# Check Week 9 status & open review:
npm run week 9

# Trigger an automated deployment to AWS Lambda:
gh workflow run deploy-lambda.yml --ref feat/senior-project-cloud-and-teaching
```
