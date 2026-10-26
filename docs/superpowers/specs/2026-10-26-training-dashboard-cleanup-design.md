# Training dashboard cleanup — design

**Branch:** `october-26-changes`  
**Date:** 2026-10-26  
**Status:** Approved in chat (role-split approach 1; dual sign-off A; People hub A+C; manager layout B)

Supersedes the **layout** sections of `2026-10-26-training-onboarding-ux-design.md`. Domain rules from that doc and the previous-user / miss-strike addendum still apply.

## Goals

1. Make Training scannable: managers see people and bottlenecks; employees certify themselves clearly.
2. Keep **dual sign-off**: trainer → employee certify → completed. Manager always sees which side is pending.
3. Drop “Onboarding” as a separate concept/section; assigning is infrequent and lives on a person.
4. Hide manager-irrelevant chrome (My training on manager view, Learn chart, All assignments, standalone Trainers, four-stat strip, long how-to card).

## Non-goals

- Email / SMS / push.
- Changing dual-sign-off rules or allowing manager to certify as the employee.
- Redesigning curriculum drag/link internals.
- Partial “pick which steps” assign UI (still assign all missing active steps in one action).

## Role views

### Employee

- Single section: **My training**.
- Lists assignments for the signed-in user.
- Primary action when `awaiting_trainee`: **I was trained — certify** (existing `applyTraineeCertify`; only that trainee).
- No curriculum, other people, or manager tools.

### Designated trainer (non-manager)

- **Sign-off queue**: assignments for paired trainees that still need trainer sign-off (`assigned` / `overdue`, and any other statuses domain already allows for `applyTrainerSignOff`).
- **My training** if they have their own assignments.
- No curriculum editor.

### Manager

Top → bottom:

1. **People** — each active employee with overview status + completed/total; open person for detail.
2. **Needs attention** — flat queue of bottlenecks (see below).
3. **Miss strikes & retrain review** — keep current strike UI + Approve retrain.
4. **Curriculum** — add / reorder / link / delete (setup).

Do **not** render My training, Onboarding, Learn chart, All assignments, standalone Trainers, or the four large stat cards on the manager view.

## People detail (manager)

Opening a person replaces the old Onboarding + Employee training sections:

| Action | Behavior |
| --- | --- |
| Assign missing steps | Same as former onboard: `buildOnboardingAssignments` for every active curriculum step not already `completed`. Label: **Assign missing steps** (never “Onboard”). |
| Per-step Mark trained | Existing manager bypass (`applyManagerMarkTrained`). |
| Per-step Require retrain | Existing (`applyManagerRequireRetrain`). |
| Trainer sign-off | If manager may train (`canTrain`), same as today. |
| Pair trainer | Designate trainer(s) for this trainee (moves pairing out of a global Trainers card). |

Show per-step status badges: Not started / Assigned / Awaiting certify / Completed / Overdue / Needs retrain.

## Needs attention (manager)

One list (or three short grouped lists) with badges for counts:

| Bucket | Filter | Row action |
| --- | --- | --- |
| Awaiting trainer | Open assignment needing trainer sign-off (`assigned` / `overdue`, and domain-allowed retrain states before trainee certify) | Trainer sign-off when `canTrain`; else open person |
| Awaiting employee | `awaiting_trainee` | Copy only: waiting on {traineeName}; manager cannot certify |
| Needs retrain | `needs_retrain` | Approve retrain |

Short one-line hint under the section title explaining dual sign-off (replace the old multi-step how-to card).

## Domain & persistence

- No change to assignment status machine or event types.
- Keep `buildOnboardingAssignments` name in code; UI copy uses Assign missing steps.
- Firestore write + listener hydration for training collections remains required (already in progress on branch).
- Empty states / hints that say “Onboarding” are rewritten.

## Implementation notes

- Prefer splitting `src/app/training/page.tsx` into small presentational components under `src/components/training/` (or similar) while keeping actions/orchestration on the page or a thin container.
- Add a pure helper (e.g. `buildTrainingAttentionBuckets`) for the three attention buckets; unit-test it.
- Update training page action tests for new labels/sections; keep domain tests.

## Success criteria

- Manager page has no My training / Onboarding / Learn chart / All assignments / Trainers card / four-stat strip.
- Employee can complete certify without seeing manager chrome.
- Manager can see awaiting-trainer vs awaiting-employee without signing in as the employee.
- Assigning a new hire is one click from that person’s detail (Assign missing steps).
