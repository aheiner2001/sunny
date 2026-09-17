# Tag Equipment Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings tags checklist questions with an equipment family; inspect resolves that family to the van’s unit(s) so flagged issues get the correct `equipmentId`.

**Architecture:** Store only `equipmentFamily` on the shared question. At inspect (and return if applicable), `listVehicleEquipmentForFamily` returns candidates on the van. One → auto-link; zero → issue without id + soft warning; two+ → required unit picker before submit. Extend `buildEquipmentFlagPayload` beyond `equipment_check`/`equipment_status` so any flagged question with a family tag links.

**Tech Stack:** Next.js 14, TypeScript, Vitest, existing `checklistPairing` + `dbService` + Settings/Inspect clients.

**Spec:** `docs/superpowers/specs/2026-09-17-tag-equipment-family-design.md`

## Global Constraints

- Settings stores family only — never bake `equipmentId` into the checklist question for this feature.
- Shared checklist for all vans; resolution runs at inspect/submit for the current `vehicleId`.
- Zero matches: still create issue; soft warning; no `equipmentId`.
- Two+ matches: block submit until inspector picks a unit.
- One match: auto-attach that unit’s id + name.
- Replace free-text “Associated Equipment Name” with Tag equipment family select; legacy `equipmentName` may remain as resolve fallback.
- For `equipment_check` / `equipment_status`, show a single family control (no duplicate pickers).
- TDD for pairing helpers: `npm test -- src/lib/__tests__/checklistPairing.test.ts`.
- Frequent commits; do not commit `tsconfig.tsbuildinfo`.

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/checklistPairing.ts` | `listVehicleEquipmentForFamily`; broaden `buildEquipmentFlagPayload` |
| `src/lib/__tests__/checklistPairing.test.ts` | 0 / 1 / 2+ tests; flag payload for yes_no + family |
| `src/app/settings/page.tsx` | Tag equipment UI; list chip `Tagged: …` |
| `src/app/inspect/InspectClient.tsx` | Multi-match picker; soft warning; submit uses chosen id |
| `src/app/return/ReturnClient.tsx` | Same resolve/pick rules if return questions can be tagged/flagged |

---

### Task 1: List-by-family helper + broaden flag payload (TDD)

**Files:**
- Modify: `src/lib/checklistPairing.ts`
- Modify: `src/lib/__tests__/checklistPairing.test.ts`

**Interfaces:**
- Consumes: existing `getEquipmentFamilyKey`, assignment helpers, `Equipment`, `answerIndicatesIssue`
- Produces:
  - `listVehicleEquipmentForFamily(equipment, vehicleId, family?: string | null): Equipment[]`
  - `buildEquipmentFlagPayload` returns link for any flagged question with family/name/id (not only equipment_check/status); `null` when answer is not an issue or when 2+ matches (UI must pick)

- [ ] **Step 1: Write failing tests** in `src/lib/__tests__/checklistPairing.test.ts` for:
  - list returns all Air Compressors on van-1 (2)
  - list empty when van has none of that family
  - list single Pressure Washer
  - `buildEquipmentFlagPayload` for yes_no + family + one unit → id/name
  - zero matches → null

- [ ] **Step 2: Run** `npm test -- src/lib/__tests__/checklistPairing.test.ts` — expect FAIL

- [ ] **Step 3: Implement** `listVehicleEquipmentForFamily` (filter on-van, not retired, family key match). Broaden `buildEquipmentFlagPayload`: drop type-only gate; if matches.length === 1 use it; if > 1 return null; if 0 fall back to `resolveVehicleEquipmentForFamily` with equipmentName then null.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit** `feat: list van equipment by family for checklist tags`

---

### Task 2: Settings — Tag equipment UI

**Files:** Modify `src/app/settings/page.tsx`

- [ ] **Step 1:** Replace free-text “Associated Equipment Name” with **Tag equipment** `<select>` bound to `equipmentFamily` from `listDistinctEquipmentFamilies`. Clear `equipmentName` on change. Single control for equipment_check/status (remove duplicate family block).

- [ ] **Step 2:** List chip `Tagged: {q.equipmentFamily}` instead of Linked equipmentName.

- [ ] **Step 3:** Save `equipmentFamily` only; do not write new free-text equipmentName from this form.

- [ ] **Step 4: Manual check in Settings**

- [ ] **Step 5: Commit** `feat: Tag equipment family picker in Settings questions`

---

### Task 3: Inspect — resolve, warn, multi-pick

**Files:** Modify `src/app/inspect/InspectClient.tsx`

- [ ] **Step 1:** State `equipmentPicks: Record<string, string>`

- [ ] **Step 2:** For flagged + family: show soft warning if 0 candidates; select if 2+; optional hint if 1

- [ ] **Step 3:** Block submit if flagged family has 2+ candidates and no pick

- [ ] **Step 4:** On submit, if payload null and pick present, attach chosen unit to response/issue

- [ ] **Step 5: Manual** 0/1/2+ vans

- [ ] **Step 6: Commit** `feat: resolve tagged equipment family to van unit on inspect`

---

### Task 4: Return checklist parity

- [ ] Grep return issue path; mirror Task 3 only if return creates equipment-linked issues; else N/A commit skip

---

### Task 5: Verification

- [ ] `npm test -- src/lib/__tests__/checklistPairing.test.ts`
- [ ] Spec success criteria manual pass

## Spec coverage

| Spec item | Task |
| --- | --- |
| Tag family in Settings | 2 |
| No unit id on question | 2 |
| list 0/1/many | 1 |
| Auto-link / zero warn / many pick | 1, 3 |
| Any flagged + family | 1, 3 |
| Return parity | 4 |
