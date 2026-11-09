# Sunny Fleet

Sunny Fleet is Aaron Heiner’s CSE 499 senior project. Employees use it to inspect vehicles, report equipment and vehicle findings, and record shifts. Managers configure checklists, review findings and hours, track training, and receive a weekly fleet report.

## Senior project handoff

**Starting point:** Week 9, November 9–15, 2026. **Next milestone:** finalize the requirements in Week 10, November 16–22. Use the October 31 Sunny Fleet Requirements Specification as the working baseline and incorporate any changes the instructor approves. The September proposal is historical. The current reporting scope uses Firestore and AWS Lambda, EventBridge, and SES. Maintenance is based on service history, verified intervals, and available readings.

The repo already has inspection, timesheet, shift correction, and training workflows. Start by verifying them with fictional users and vehicles. Treat GitHub code and checked-in tests as implementation evidence, and record separate acceptance evidence for actual browser flows, Firebase access, and scheduled delivery. Locate the deployed weekly Lambda source before changing reporting logic. The repo’s offline Python maintenance tool is a separate implementation until the connection is verified.

### Week 10 requirements checklist

| Priority | Requirement | Evidence to capture |
| --- | --- | --- |
| M1 | Manager checklist configuration | Save a unique checklist item and see it in the employee checklist after reload. |
| M2 | QR vehicle inspection | Submit answers, photo, and signature. Reopen them under the correct vehicle and employee. |
| M3 | Pending finding review | Convert a flagged finding to one tracked issue linked to its source inspection and vehicle. |
| M4 | Employee shift recording | Verify a 09:00–11:00 shift with a 15-minute unpaid break equals 1.75 hours. Force a clock-in failure and confirm inspection still opens. |
| M5 | Manager hours approval | Approve a 1.75-hour shift and verify it moves from pending to approved once, including after reload and retry. |
| M6 | Scheduled weekly email | Receive a test email from a scheduled invocation and reconcile its selected week and CSV totals against known records. Verify preview sends no email. |
| S1 | Training progress | Complete one assigned lesson and verify both roles see the persisted result. Confirm employee access is limited to their own progress. |
| S2 | Shift correction requests | Confirm pending requests leave approved hours alone, approval applies once, and rejection preserves the original shift. |
| S3 | Vehicle maintenance deadlines | Compare the date and mileage limits with hand calculations. Confirm a known calendar deadline still appears when mileage is missing. |
| S4 | Observed vehicle mileage | Verify 10,000 to 10,120 yields 120 observed miles. Check duplicate, decreasing, missing, and partial-coverage readings. |

Before finalizing, mark each row **passed**, **failed**, or **unverified**, and separate the requirement from its implementation status. Keep M1–M6 as the proposed baseline. S1 already covers employee completion and manager visibility. Discuss moving it to must-have or requiring trainer sign-off only if that reflects a stakeholder need. Get instructor approval for any changes to approved requirements before the Week 10 cutoff. Keep the dated specification with the course materials.

### Remaining work and estimated hours

| Week | Dates | Planned hours | Work and exit evidence |
| --- | --- | ---: | --- |
| 9 | Nov 9–15 | 6 | Prepare two fictional employees, one manager, two test vehicles, and a controlled email address. Run a prototype smoke test across inspections, timesheets, and report preview. Record gaps and gather prototype evidence. |
| 10 | Nov 16–22 | 16 | Rehearse M1–M6, prioritize defects that block acceptance, and finalize the specification. Confirm the photo persistence path, check employee attempts at manager-only actions, and document any instructor-approved scope changes. |
| 11 | Nov 23–29 | 8 | Verify training and shift corrections across roles. Fix the highest-impact issue found and capture before/after evidence. Start the local report preview only if the baseline demos are on track. |
| 12 | Nov 30–Dec 6 | 16 | Reconcile weekly hours and CSVs with fixtures, check Mountain Time week boundaries, and verify maintenance and observed mileage edge cases. Run a controlled scheduled delivery and restore the intended schedule. Use remaining time for the local API prototype. |
| 13 | Dec 7–13 | 16 | Rehearse the final demo from a clean test environment, resolve remaining acceptance blockers, organize evidence by requirement ID, and demonstrate the project. |
| 14 | Dec 14–20 | Track actual time | Complete the reflection and any required wrap-up. Summarize verified results, remaining limitations, and what was learned. |

**Planned through Week 13: 62 hours.** These are planning estimates carried over from the proposal’s weekly budgets, with the work reassigned to the current scope. Log actual time by date, requirement ID, activity, duration, and evidence such as a commit, test result, or demo note. Count investigation, implementation, verification, documentation, and rehearsal as separate activities in the log. Compare the total with the course’s required hours and time already logged.

### Optional backend practice

Keep Firebase Auth and Firestore. Use a separate local, read-only HTTP service with fictional fixtures and no production credentials. Do this after the relevant acceptance checks are on track.

1. **Weekly report preview** — Build `GET /reports/weekly/preview?weekStart=2026-11-02`. Start with 1.75 approved hours and 2 pending hours. Reuse the existing calculation if the Lambda source supports it. Return JSON and keep email delivery out of this path.
2. **Training gaps** — Build `GET /training/gaps` using the existing assignment and progress rules. Show incomplete assignments and retraining needs. Verify that a fully completed assignment is excluded.
3. **Permissions and AWS follow-up** — Call both endpoints with `curl`. Test a valid manager, invalid input, missing credentials, and an employee denied manager access. Use a verified Firebase ID token and a trusted manager role for real auth integration. If there is time and a budget, try a separate API Gateway and test Lambda deployment. The scheduled email remains a separate workflow.

### Where to start in the repo

- [Checklist settings](src/app/settings/page.tsx), [inspection](src/app/inspect/InspectClient.tsx), and [Pending findings](src/app/pending/page.tsx)
- [Timesheets](src/app/timesheets/TimesheetsClient.tsx) and [manager review tests](src/app/timesheets/__tests__/ManagerReview.test.tsx)
- [Training](src/app/training/page.tsx) and [training domain logic](src/lib/training/trainingDomain.ts)
- [Offline maintenance report](docs/maintenance-report.md)
