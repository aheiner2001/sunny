# Sunny Fleet Senior Project (CSE 499) Master Roadmap

> **Total Commitment:** 60 planned hours remaining (Weeks 9–13).  
> **Command:** Run `npm run week <number>` (e.g. `npm run week 9`) to display tasks, deep principles, and launch interactive lessons.

## Schedule Overview

| Week | Target Dates | Planned | Status | Primary Focus |
| :--- | :--- | :---: | :---: | :--- |
| **Week 9** | Nov 9–15 | 10 hrs | 🟡 In Progress | Automated Lambda CI/CD & Baseline Smoke Test |
| **Week 10** | Nov 16–22 | 14 hrs | ⚪ Planned | M1–M6 Requirements Acceptance Gate & Unified Theme Switcher |
| **Week 11** | Nov 23–29 | 12 hrs | ⚪ Planned | Cloud Security & Stateless Firebase JWT Validation |
| **Week 12** | Nov 30–Dec 6 | 12 hrs | ⚪ Planned | Scheduled Fleet Reporting & Data Integrity |
| **Week 13** | Dec 7–13 | 12 hrs | ⚪ Planned | Final Demo Rehearsal & Portfolio Packaging |

---

## Detailed Weekly Curriculum

### Week 9: Automated Lambda CI/CD & Baseline Smoke Test (10 hrs)
- **Course Goals**: Fictional test users/vehicles smoke test, baseline smoke evidence.
- **Engineering Principles**: Infrastructure as Code (IaC), Continuous Deployment (CD), AWS IAM OIDC security.
- **Deliverables**: `.github/workflows/deploy-lambda.yml`, `scripts/week.mjs`, verified smoke test suite.
- **Lesson**: `courses/cse499/lessons/0001-lambda-cicd-oidc.html`

### Week 10: Requirements Acceptance Gate & Theme Switcher (14 hrs)
- **Course Goals**: Freeze specification, test and pass M1–M6.
- **Engineering Principles**: Design token scoping, idempotency, role-based frontend boundaries.
- **Deliverables**: In-app Theme Switcher (Enterprise vs Switch UI), M1–M6 recorded sign-off matrix.
- **Lesson**: `courses/cse499/lessons/0002-theme-state-isolation.html`

### Week 11: Cloud Security & Firebase JWT Validation (12 hrs)
- **Course Goals**: Complete training progress verification (S1) and secure reporting endpoints.
- **Engineering Principles**: Stateless JWT authentication, Google JWKS public key verification, RBAC.
- **Deliverables**: Cryptographically authenticated AWS Lambda handler, frontend Bearer token integration.
- **Lesson**: `courses/cse499/lessons/0003-stateless-jwt-auth.html`

### Week 12: Scheduled Reporting & Data Integrity (12 hrs)
- **Course Goals**: Reconcile weekly shift totals and verify stretch goals S2–S4.
- **Engineering Principles**: Timezone boundary math, immutable audit history, automated regression testing.
- **Deliverables**: Verified Mountain Time shift calculations, automated scheduled SES email proof.
- **Lesson**: `courses/cse499/lessons/0004-timezone-reporting-reconciliation.html`

### Week 13: Final Demo Rehearsal & Portfolio Packaging (12 hrs)
- **Course Goals**: Capstone presentation, final reflection, and code freeze.
- **Engineering Principles**: Architecture visualization, clean-state testing, executive demonstration.
- **Deliverables**: Architecture diagram, recorded demo video, resume bullets, project reflection.
- **Lesson**: `courses/cse499/lessons/0005-portfolio-and-demo.html`
