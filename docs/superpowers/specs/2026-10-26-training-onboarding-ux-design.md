# Training onboarding UX — design

**Branch:** `october-26-changes`  
**Date:** 2026-10-26  
**Status:** Approved (user: approve)

## Goals

1. Separate **curriculum** (add / reorder / delete) from **assigning people**.
2. Manager **people overview**: each employee Up to date / Needs training / Needs retrain.
3. **Onboarding** assigns **all** active curriculum steps to a chosen employee, surfaces work on My training, and leaves an in-app note for paired trainers (no email/SMS).
4. **Retrain**: miss streak → needs review → manager Approves retrain → that item returns to dual sign-off.

## Non-goals (this pass)

- Email / SMS / push.
- Partial step picker on onboard (always all active steps; skip items already `completed`).
- Drag library beyond simple up/down reorder if HTML5 drag is flaky — up/down + delete is acceptable MVP; prefer drag when straightforward.

## Layout

1. People overview (top)
2. Onboarding action
3. Retrain review queue (flagged `needs_retrain`)
4. Curriculum editor (no Assign to)
5. Assignments / My training (sign-off paths unchanged)

## Default onboard rule

Assign every **active** curriculum item that is not already `completed` for that trainee.
