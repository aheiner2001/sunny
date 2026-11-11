# Design Spec: Sunny Fleet Senior Project & Cloud Architecture

- **Date:** 2026-11-11
- **Status:** Approved
- **Author:** Aaron Heiner
- **Course / Capstone:** BYU–Idaho CSE 499 Senior Project (Sunny Fleet)
- **Target Hours:** 60 Planned Hours across Weeks 9–13
- **Primary Deliverables:** Automated AWS Lambda CI/CD, Firebase JWT Cloud Security, Unified Theme Switcher, Educational Manifest & Week Command, M1–M6 Course Acceptance

---

## 1. Executive Summary & Purpose

Sunny Fleet is a fleet management, vehicle inspection, and equipment accountability system for mobile auto-detailing operations. The project currently has 70 logged hours out of the 126-hour capstone requirement. This specification establishes the blueprint for the remaining ~60 hours across Weeks 9 through 13.

The goal is twofold:
1. **Academic Excellence & Graduation**: Satisfy the Week 10 Requirements Acceptance Gate (M1–M6 must-haves) and generate rock-solid verifiable acceptance evidence.
2. **Professional Engineering Portfolio**: Eliminate manual AWS console code copying by implementing an automated GitHub Actions CI/CD deployment pipeline, harden AWS Lambda endpoints with cryptographic Firebase JWT authentication (RBAC), package a seamless Theme Switcher (Enterprise SaaS vs Nintendo Switch UI), and establish a `/teach`-driven educational tracking framework.

---

## 2. Weekly Master Schedule & 60-Hour Allocation

| Week | Date Range | Planned Hours | Milestones & Deliverables | Exit & Evidence Artifacts |
| :--- | :--- | :---: | :--- | :--- |
| **Week 9** | Nov 9–15, 2026 | **10 hrs** | **Automated Lambda CI/CD & Baseline Smoke Test**: Setup `.github/workflows/deploy-lambda.yml` with AWS IAM/OIDC to test, zip, and deploy `courses/itm300/aws-lambda/` on push to `main`. Establish `courses/cse499/roadmap.json` and `scripts/week.mjs`. Smoke test test users and vehicles. | GitHub Actions pipeline run, automated deployment badge, clean smoke test logs. |
| **Week 10** | Nov 16–22, 2026 | **14 hrs** | **Requirements Lockdown (M1–M6) & Theme Switcher**: Rehearse and record evidence for M1–M6 requirements. Integrate the **Theme Switcher** in Settings/Header to toggle between Classic Enterprise and Nintendo Switch UI. Finalize specification document. | Signed-off M1–M6 acceptance matrix, working theme switcher, frozen course specification. |
| **Week 11** | Nov 23–29, 2026 | **12 hrs** | **Cloud Security & Stateless Firebase JWT Validation**: Update AWS Lambda to verify Firebase ID tokens via Google JWKS public certificates. Enforce manager-only authorization (HTTP 401/403) on `/reports/weekly/preview` and `/training/gaps`. Update frontend fetcher. | CloudWatch authentication logs, curl verification scripts proving 200 vs 401/403. |
| **Week 12** | Nov 30–Dec 6, 2026 | **12 hrs** | **Scheduled Fleet Reporting & Data Quality**: Audit Mountain Time week boundaries, test scheduled EventBridge email delivery via AWS SES vs on-demand preview. Execute Vitest regression suite. | Reconciled timesheet CSV report, automated email screenshot, zero-regression test report. |
| **Week 13** | Dec 7–13, 2026 | **12 hrs** | **Final Demo Rehearsal & Portfolio Packaging**: Rehearse live demonstration from clean state. Create polished cloud architecture diagram, demo walkthrough video, and write technical resume bullet points. | Architecture diagram, demo recording, senior project reflection document, updated resume bullets. |
| **Total** | | **60 hrs** | *Fulfills senior project hour commitment with strong industry-grade artifacts.* | |

---

## 3. Educational Tracking System & Weekly Command

To operationalize the `/teach` skill and enable deep learning for each milestone, `courses/cse499/` serves as an active educational workspace.

```
courses/cse499/
├── roadmap.json              <-- Machine-readable source of truth (status, hours, requirements, principles)
├── ROADMAP.md                <-- Human-readable weekly guide with progress tables & resource links
├── lessons/                  <-- Interactive, self-contained HTML lessons for each core concept
│   ├── 0001-lambda-cicd-oidc.html
│   ├── 0002-jwt-stateless-auth.html
│   └── ...
├── learning-records/         <-- Engineering decisions & insights (0001-*, 0002-*)
├── reference/                <-- Cheat sheets & architecture diagrams
└── MISSION.md & RESOURCES.md <-- Long-term goal anchor and primary source citations
```

### 3.1 Manifest Schema (`courses/cse499/roadmap.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SunnyFleetSeniorProjectRoadmap",
  "totalPlannedHours": 60,
  "totalLoggedHours": 0,
  "currentWeek": 9,
  "weeks": {
    "9": {
      "title": "Automated Lambda CI/CD & Baseline Smoke Test",
      "plannedHours": 10,
      "loggedHours": 0,
      "status": "in_progress",
      "courseRequirements": ["M1-prep", "M4-prep", "M6-prep"],
      "engineeringPrinciples": [
        "Infrastructure as Code (IaC) vs Manual Console Drifts",
        "Continuous Deployment (CD) with GitHub Actions Workflows",
        "Least Privilege & Short-Lived Secrets via AWS IAM OIDC"
      ],
      "lessonFile": "courses/cse499/lessons/0001-lambda-cicd-oidc.html",
      "learningRecord": "courses/cse499/learning-records/0001-lambda-github-cicd.md",
      "resources": [
        { "name": "GitHub Actions: Security Hardening with OpenID Connect", "url": "https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect" },
        { "name": "AWS Lambda CLI update-function-code", "url": "https://docs.aws.amazon.com/cli/latest/reference/lambda/update-function-code.html" }
      ],
      "tasks": [
        { "id": "W9.1", "desc": "Draft .github/workflows/deploy-lambda.yml", "status": "pending" },
        { "id": "W9.2", "desc": "Setup IAM role and trust policy for GitHub OIDC", "status": "pending" },
        { "id": "W9.3", "desc": "Test automated push to update AWS Lambda", "status": "pending" },
        { "id": "W9.4", "desc": "Smoke test 2 fictional employees and 1 manager", "status": "pending" }
      ]
    }
  }
}
```

### 3.2 Weekly CLI Command: `npm run week <number>`
A dedicated runner (`scripts/week.mjs`) provides instant access:
1. Validates the week number (9–13).
2. Reads `roadmap.json` and outputs a rich console dashboard (hours logged vs planned, task checklist).
3. Displays a deep conceptual explanation of the engineering principles for that week.
4. Automatically opens the interactive HTML lesson in the default browser (`open courses/cse499/lessons/*.html`).
5. Generates the exact next command and test fixtures to work on.

---

## 4. AWS Lambda GitHub Actions CI/CD Architecture

### 4.1 Objective
Eliminate manual copy-pasting of code into the AWS Lambda Console by establishing an automated continuous deployment workflow triggered on git commits.

```
[ Developer ] -- git push main --> [ GitHub Repository ]
                                           |
                                           v  (Triggers on path: courses/itm300/aws-lambda/**)
                               [ GitHub Actions Runner ]
                                           |
                       +-------------------+-------------------+
                       |                                       |
                       v                                       v
               1. Pre-deploy Test                      2. Authenticate with AWS
             (Node syntax & unit check)              (OpenID Connect / OIDC Role)
                       |                                       |
                       +-------------------+-------------------+
                                           |
                                           v
                                3. Package Function
                                  (Zip index.mjs)
                                           |
                                           v
                              4. Update AWS Lambda Code
                                (aws lambda update-function-code)
                                           |
                                           v
                               [ Live AWS Lambda Function ]
                               (Weekly Report & API Gateway)
```

### 4.2 Workflow Specification (`.github/workflows/deploy-lambda.yml`)
- **Triggers**: 
  - `push` to branch `main` affecting `courses/itm300/aws-lambda/**` or `lambda/**`.
  - `workflow_dispatch` for manual on-demand triggers.
- **Permissions**:
  - `id-token: write` (for AWS OIDC token exchange).
  - `contents: read`.
- **Authentication**:
  - Uses `aws-actions/configure-aws-credentials@v4` with `role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>` and `aws-region: us-east-2`.
  - Fallback: supports repository secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` if OIDC role creation is restricted.
- **Deployment Command**:
  ```bash
  zip -r deployment.zip index.mjs package.json node_modules
  aws lambda update-function-code \
    --function-name sunny-weekly-fleet-report \
    --zip-file fileb://deployment.zip \
    --publish
  aws lambda wait function-updated --function-name sunny-weekly-fleet-report
  ```
- **Guards**: Deployment is aborted if pre-deploy unit tests or `node --check index.mjs` fail.

---

## 5. Cloud Security: Stateless Firebase JWT Validation

### 5.1 Objective
Transform the AWS Lambda from an open HTTP handler into a secure, enterprise-grade cloud service that cryptographically verifies caller identity and enforces manager-only access control.

### 5.2 Architecture & Flow
```
[ Next.js Client ]
      |
      | 1. Authenticate with Firebase Auth
      | 2. Extract JWT: await auth.currentUser.getIdToken()
      | 3. GET /reports/weekly/preview?weekStart=YYYY-MM-DD
      |    Header: Authorization: Bearer <jwt>
      v
[ AWS API Gateway (us-east-2) ]
      |
      | Proxy HTTP payload & headers
      v
[ AWS Lambda (index.mjs) ]
      |
      +---> Is event.source === 'aws.events'? (Scheduled Cron)
      |         |-- YES: Execute batch email report & send via SES directly.
      |
      +---> Is HTTP GET /reports/weekly/preview?
                |
                v
        Extract Bearer token from headers.authorization
                |
                +-- Missing? ---------> Return 401 Unauthorized
                |
                v
        Fetch & cache Google JWKS from:
        https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
                |
                v
        Verify signature, expiration, issuer (https://securetoken.google.com/<projectId>),
        and audience (<projectId>).
                |
                +-- Invalid/Expired? -> Return 401 Unauthorized
                |
                v
        Verify manager role claim or manager email whitelist.
                |
                +-- Not Manager? -----> Return 403 Forbidden
                |
                +-- Authorized -------> Return 200 OK { reportData, timesheetTotals }
```

### 5.3 Error Handling Specifications
- **401 Unauthorized**: Returned with `{ "error": "Missing or invalid bearer token" }` when no token or an expired/tampered token is supplied.
- **403 Forbidden**: Returned with `{ "error": "Forbidden: Requires manager privileges" }` when a valid employee token attempts to access manager endpoints.
- **200 OK**: Returned with preview JSON. Strictly suppresses SES email delivery in preview mode.

---

## 6. Unified Theme Switcher & UI Showcase

### 6.1 Objective
Provide a unified, persistent interface toggle allowing evaluators and recruiters to seamlessly switch between the **Classic Fleet OS (Enterprise Mode)** and the gamified **Nintendo Switch UI** authored on the `switch_merge` branch.

### 6.2 Architectural Design
- **Storage**: Key `sunny_theme_mode` in `localStorage` storing `'classic' | 'switch'`. Defaults to `'classic'`.
- **Global Event**: Dispatches `window.dispatchEvent(new Event('sunny_theme_change'))` upon change.
- **DOM Integration**: Applies `.theme-switch-ui` to `document.body` when active; removes it when `'classic'` is selected.
- **Audio Feedback**: The audio module (`src/lib/switchAudio.ts`) checks both the user's audio preference and `sunny_theme_mode === 'switch'`, remaining completely silent in Enterprise mode.
- **Navigation Controls**:
  - `Settings > Appearance`: Visual cards explaining each theme with radio toggles.
  - `Header Navbar`: Pill-shaped quick-toggle badge for instant switching during live presentations.

---

## 7. Requirements Acceptance Gate (M1–M6) & Testing

### 7.1 Course Baseline Requirements (Week 10 Gate)

| ID | Requirement | Test Scenario | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **M1** | Manager Checklist Config | Add custom checklist question in `/settings`. Reload. | Item persists in Firestore and appears in employee inspection view. |
| **M2** | QR Vehicle Inspection | Submit inspection with pass/flag answers, photo, and signature. | Data saves and reopens under correct vehicle and employee. |
| **M3** | Pending Finding Review | Review flagged inspection item in `/pending` and convert to issue. | Converts to 1 tracked issue linked to vehicle and source inspection. |
| **M4** | Employee Shift Recording | Clock in 09:00, 15m unpaid break, clock out 11:00. | Yields 1.75 net hours. If clock-in fails offline, inspection flow opens. |
| **M5** | Manager Hours Approval | Approve 1.75-hour shift in manager review table. | Moves from pending to approved once. Idempotent across reloads. |
| **M6** | Scheduled Weekly Email | Trigger test run of scheduled weekly Lambda report. | Receives email with CSV attachment. Reconciles with records. Preview sends no email. |

### 7.2 Stretch Goals (S1–S4)
- **S1 (Training Progress)**: Complete assigned training module; verify manager visibility and employee isolation.
- **S2 (Shift Corrections)**: Ensure pending corrections do not modify approved hours until approved.
- **S3 (Maintenance Deadlines)**: Verify calendar deadlines display when odometer reading is absent.
- **S4 (Observed Mileage)**: Verify mileage calculations (10,000 to 10,120 = 120 mi) handle missing/out-of-order readings gracefully.

---

## 8. Portfolio & Resume Presentation Artifacts

1. **Resume Bullets**:
   - *Architected an automated CI/CD pipeline using GitHub Actions and AWS IAM OIDC, deploying serverless microservices to AWS Lambda with zero credential storage and automated pre-flight testing.*
   - *Engineered a stateless role-based security layer (RBAC) on AWS Lambda validating Firebase JWTs against Google JWKS public certs to protect sensitive fleet analytics.*
   - *Developed a responsive dual-theme design system in React 19/Next.js featuring custom audio drivers, CSS class scoping, and dynamic local state persistence.*
2. **Demo Video & Clean State**: A recorded 5-minute walkthrough demonstrating QR inspection, shift approval, theme switching, and automated CI/CD deployment.
