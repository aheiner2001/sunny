# Week 10 Comprehensive Status Report & Requirements Finalization

**Course:** BYU–Idaho CSE 499 Senior Project (`Sunny Fleet`)  
**Target Window:** Week 10 (Nov 16–22, 2026)  
**Hours Allocated:** 16 Hours Claimed (20+ Actual Hours Expended)  
**Cumulative Hours:** 96 / 126 Hours (76.2% Complete | 30 Hours Remaining Across Weeks 11–13)  
**Status:** ✅ **REQUIREMENTS BASELINE VERIFIED & FINALIZED**  
**Repository Branch:** `feat/senior-project-cloud-and-teaching`  

---

## 1. Executive Summary

Week 10 represents the official **Requirements Finalization Gate** for the Sunny Fleet senior project. During this cycle, extensive end-to-end integration testing and regression sweeps were conducted across both browser client flows and cloud backend infrastructure.

All core must-have functional requirements (**M1 through M6**) were systematically rehearsed, validated against edge cases (network failure, page reloads, retry collisions), and verified for data consistency between Firebase Firestore, Cloud Storage, and AWS Lambda microservices. With all acceptance criteria satisfied, the functional baseline is locked down for instructor sign-off.

---

## 2. Requirements Verification & Evidence Matrix (M1–M6 Baseline)

| Requirement ID | Module / Workflow | Verification Actions & Evidence Captured | Status |
| :--- | :--- | :--- | :---: |
| **M1: Manager Checklist Configuration** | Checklist Settings (`src/app/settings/page.tsx`) | Created and saved custom vehicle inspection items. Verified dynamic persistence in Firestore and confirmed real-time rendering in the employee inspection view (`/inspect`) across full browser cache reloads. | **PASSED** |
| **M2: QR Vehicle Inspection** | Vehicle Inspection (`src/app/inspect/InspectClient.tsx`) | Executed full inspection cycle with multi-point question responses, camera condition photo uploads, and canvas signature capture. Verified records link immutably to target Vehicle and Employee IDs in Firestore and Cloud Storage. | **PASSED** |
| **M3: Pending Finding Review** | Finding Triage (`src/app/pending/page.tsx`) | Converted flagged inspection defects into formal tracked maintenance tickets. Verified 1-to-1 relationship mapping back to the originating inspection record and vehicle equipment logs. | **PASSED** |
| **M4: Employee Shift Recording** | Timesheets (`src/app/timesheets/TimesheetsClient.tsx`) | Verified exact time calculations: `09:00–11:00` with a 15-minute unpaid break correctly calculates to `1.75` hours. Tested fault-tolerance: simulated clock-in network dropouts and confirmed inspection workflow still functions independently without corrupting shift records. | **PASSED** |
| **M5: Manager Hours Approval** | Timesheet Review (`ManagerReview.test.tsx`) | Tested single-transition approval logic for pending shifts. Validated idempotency: multiple rapid clicks, page refreshes, and network retries do not trigger duplicate approvals or double-credit hours. | **PASSED** |
| **M6: Scheduled Weekly Reporting** | AWS Serverless Backend (`lambda/index.mjs`) | Verified AWS Lambda reporting service (`us-east-2`). Tested scheduled EventBridge cron delivery via Amazon SES with accurate CSV timesheet and maintenance rollups. Confirmed API Gateway `/preview` endpoint executes read-only JSON calculations without triggering emails. | **PASSED** |

---

## 3. Bug Fixes, Hardening & Technical Refinements

During the 20+ hours of testing and edge-case validation, several stability issues were triaged and resolved:
1. **Timesheet Break Calculation Precision:** Eliminated floating-point rounding anomalies in unpaid break deductions, standardizing on two-decimal hundredths (`1.75` hours).
2. **Double-Punch & Approval Race Conditions:** Reinforced Firestore transaction isolation so concurrent manager approvals or retry clicks cannot corrupt state or generate duplicate approval logs.
3. **Inspection Decoupling on Clock-In Failures:** Ensured that if an employee experiences a clock-in or network error, they are not blocked from completing emergency vehicle safety inspections.
4. **Role-Based Access Enforcement:** Audited client routes and Firestore security rules to ensure employees cannot access manager configuration panels (`/settings`, `/pending` conversions).

---

## 4. Cumulative Hours & Velocity Progress

* **Hours Completed Prior to Week 10:** 80 Hours
* **Hours Claimed for Week 10:** 16 Hours (investigation, browser smoke testing, bug fixes, regression sweeps, and specification lock-in)
* **Total Hours to Date:** **96 / 126 Hours**
* **Remaining Budget:** 30 Hours remaining across Weeks 11, 12, and 13 (~10 hours/week):
  * **Week 11 (Nov 23–29):** 8–10 Hours — Training progress matrices (S1) and shift correction workflows (S2).
  * **Week 12 (Nov 30–Dec 6):** 10–12 Hours — Mountain Time boundary edge cases, maintenance interval math (S3, S4), and scheduled delivery reconciliation.
  * **Week 13 (Dec 7–13):** 10–12 Hours — Clean environment final presentation rehearsal, evidence collation, and demo.
  * **Week 14 (Dec 14–20):** Final reflection and course wrap-up.
