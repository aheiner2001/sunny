# Training Curriculum UX & Architecture Research: The Khan Academy Micro-Learning Pattern

**Date**: November 2026  
**Context**: Sunny Fleet Management (`/Users/aaronheiner/sunny`)  
**Target Areas**: `/src/app/training/page.tsx`, `/src/lib/training/trainingDomain.ts`, `/src/lib/training/types.ts`, `/src/components/CurriculumSortList.tsx`, `/src/components/training/MyTrainingSection.tsx`

---

## 1. Executive Summary & Problem Analysis

### Current State
In Sunny Fleet, training functions primarily as a compliance checklist and dual-signature verification mechanism:
1. **Curriculum Authoring**: In `CurriculumSortList.tsx` and `page.tsx`, managers can only create a bare single-string training item (e.g. "Check oil levels"). Configuration is limited to due days, retrain threshold, and linking inspection question IDs.
2. **Employee Experience**: In `MyTrainingSection.tsx`, trainees see a flat, grey list of assigned step titles with status badges (`assigned`, `awaiting_trainee`, `completed`). When `awaiting_trainee` is active, they only see a button labeled *"I was trained — certify"*. There is no instructional content, zero visual aids (photos/diagrams), no bite-sized walkthrough, and no self-paced learning material.
3. **Manager Perception**: The curriculum interface feels "rough" and utilitarian. It lacks an intuitive authoring workflow for teaching *how* or *why* to do something with visual references (e.g. photos of correct oil dipstick markings, battery tie-downs, or tire wear patterns).

### The Vision (Khan Academy / Modern Microlearning Model)
Modern microlearning platforms (such as **Khan Academy**, **Duolingo**, and modern frontline LMSs like **Axonify** or **SafetyCulture/EdApp**) adhere to core pedagogical principles:
- **Modular Hierarchy**: Curriculum -> Units/Topics -> Bite-Sized Lessons/Modules -> Step Cards.
- **Visual & Bite-Sized Delivery**: 1 idea per card. 1–3 punchy bullet points, an annotated image/diagram, and estimated completion time (e.g., "2 min").
- **Interactive Checkpoints & Mastery**: Quick self-checks or visual confirmation ("Does your vehicle look like Photo A or Photo B?") before sign-off.
- **Manager-Friendly Lightweight Authoring**: Managers can create rich micro-modules in 60 seconds (Title, Summary, Cloud Image/Diagram, Key Bullet Points, Verification Check).
- **Dual Sign-Off Integrity Preserved**: Sunny's core accountability mechanism (linked vehicle inspection miss strikes triggering retrains) remains completely intact, seamlessly augmented by micro-learning modules.

---

## 2. Benchmark Architecture: Khan Academy & Microlearning Patterns

### 2.1 Khan Academy Mastery Pattern
1. **Unit & Lesson Scaffolding**:
   - High-level progress tracker (Unit mastery bar: e.g., "75% Mastered").
   - Discrete, sequential lesson nodes along a path or timeline.
2. **Interactive Card Runner (The "Step Runner")**:
   - Instead of a long wall of text, lessons are broken into 3 to 5 digestible cards:
     - **Card 1: Concept / Objective** (Short, 1-2 sentences with an anchor visual).
     - **Card 2: Visual Demonstration** (Annotated photo or diagram with callouts).
     - **Card 3: Pro-Tips / Common Pitfalls** (Bulleted checklist of common mistakes).
     - **Card 4: Check for Understanding / Micro-Quiz** (1 multiple choice question or binary choice: "Safe vs. Unsafe").
3. **Reward & Completion State**:
   - Visual progress fill, checkmark animation, immediate progression to "Ready for Trainer Verification".

### 2.2 Frontline Microlearning Best Practices (Fleet & Operations)
- **Time-to-Consume < 3 Minutes**: Fleet drivers and field technicians check their phones on the lot or in the cab. They need micro-content consumable during morning standups or pre-trip preparation.
- **Image-First Guidance**: In vehicle operations, a photo of an amber dash warning light or an improperly seated hitch is worth 1,000 words of compliance text.
- **Seamless 1-Click Verification**: Trainee self-certification is preceded by reviewing the cards, followed by digital trainer sign-off.

---

## 3. Data Model Evolution (Non-Breaking)

To support Khan Academy-style bite-sized cards and visual modules while maintaining 100% backward compatibility with existing Firestore records and localStorage caches (`STORAGE_KEYS.TRAINING_ITEMS`), we evolve `TrainingItem`:

### 3.1 Proposed Types Schema (`src/lib/training/types.ts`)

```typescript
export interface TrainingCard {
  id: string;
  title?: string;
  imageUrl?: string;        // Storage URL or curated image
  imageCaption?: string;
  content: string;          // Markdown or plain text bullet points
  calloutType?: 'info' | 'warning' | 'tip'; // Visual accent
  calloutText?: string;
}

export interface TrainingQuizCheck {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

export interface TrainingItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  active: boolean;
  deadlineType: TrainingDeadlineType;
  withinDays?: number;
  retrainThreshold: number;
  linkedQuestionIds: string[];
  createdAt: string;
  updatedAt: string;

  // --- NEW KHAN-ACADEMY PATTERN EXTENSIONS ---
  category?: 'inspection' | 'safety' | 'fleet_tools' | 'maintenance' | 'general';
  coverImageUrl?: string;          // Thumbnail for curriculum card view
  estimatedMinutes?: number;       // e.g. 3 (default: 3-5 mins)
  keyTakeaways?: string[];         // 2-4 punchy bullet points
  cards?: TrainingCard[];          // Multi-step micro-lesson runner
  quiz?: TrainingQuizCheck;        // Optional 1-question knowledge check
}
```

### 3.2 Assignment Progress Extension
```typescript
export interface TrainingAssignment {
  id: string;
  traineeId: string;
  traineeName: string;
  itemId: string;
  status: TrainingAssignmentStatus;
  dueAt: string | null;
  missStreak: number;
  events: TrainingEvent[];
  createdAt: string;
  updatedAt: string;

  // --- NEW PROGRESS TRACKING ---
  completedCardIds?: string[];     // Tracks card-level progress in micro-runner
  quizPassed?: boolean;
}
```

*Note: Because all new fields are optional (`?`), existing Firestore records parse without error, and default fallbacks are used when fields are absent.*

---

## 4. UX Architecture & Wireframe Proposals

### 4.1 Manager Curriculum Authoring Experience
Currently, the manager adds a bare title in an inline form (`<input placeholder="New training step title" />`). 

#### The Redesigned Authoring Flow:
1. **Curriculum Matrix / Board View**:
   - Cards display category badges, thumbnail image preview, estimated time, and linked inspection count.
   - Quick action: **"Edit Lesson & Media"** opens an interactive Drawer / Modal.
2. **Lightweight Card-Based Editor (Modal/Drawer)**:
   - **Tab 1: Basic Info**: Title, Category, Estimated Time, Target Due Days, Retrain Threshold.
   - **Tab 2: Visual Media & Steps**:
     - Upload or paste image URL (Firebase Storage integration).
     - Add 1–3 quick step cards (e.g. Card 1: "Where to look", Card 2: "Proper level indicator", Card 3: "Reporting an issue").
     - Key Takeaways bullet builder.
   - **Tab 3: Inspection Accountability (The Sunny Secret Weapon)**:
     - Checkbox link to pretrip/return questions that trigger miss strikes.

### 4.2 Employee Learning Experience: The Khan-Style Step Runner
Currently, the employee sees a plain table row and a single "I was trained" button.

#### The Redesigned Trainee Experience:
1. **Visual Learning Dashboard (`MyTrainingSection.tsx`)**:
   - Hero progress bar: **"Unit Progress: 3 of 5 Steps Complete (60%)"**.
   - Modular Cards grouped by Status ("Ready to Learn", "Awaiting Trainer Verification", "Mastered").
   - Each card displays cover image, estimated duration pill ("⏱ 2 min"), and clear status badge.
2. **Interactive Micro-Runner Modal (`TrainingCardRunner.tsx`)**:
   - Displays a multi-step carousel (Step 1 of 3 -> Step 2 of 3 -> Knowledge Check).
   - Crisp imagery with pinch-to-zoom / tap-to-enlarge.
   - High-contrast bullet points formatted for quick phone skimming.
   - Optional 1-click self-check ("Check understanding").
   - Final Slide: Prompts the trainee to request trainer sign-off or certifies if already signed off.

```
+-----------------------------------------------------------+
|  Training: Engine Oil & Fluid Inspection         [X Close] |
|  [ ====== Step 2 of 3 ======            ]                  |
+-----------------------------------------------------------+
|                                                           |
|    +-------------------------------------------------+    |
|    |                                                 |    |
|    |          [ HIGH QUALITY PHOTO/DIAGRAM ]         |    |
|    |       Showing Min/Max dipstick hashmarks        |    |
|    |                                                 |    |
|    +-------------------------------------------------+    |
|                                                           |
|   Proper Fluid Reading:                                   |
|   • Wipe dipstick with clean rag first, reinsert fully    |
|   • Oil level MUST sit between the two cross-hatched dots |
|   • If below bottom dot, do NOT start engine; notify shop |
|                                                           |
|   [!TIP] Check when engine is cold and on level ground.   |
|                                                           |
+-----------------------------------------------------------+
|  [ < Previous ]                             [ Next Step > ]|
+-----------------------------------------------------------+
```

---

## 5. Concrete Implementation Roadmap for Sunny

### Phase 1: Domain & Types Foundation
1. Extend `types.ts` with `TrainingCard`, `category`, `coverImageUrl`, `estimatedMinutes`, `cards`, and `keyTakeaways`.
2. Update `trainingUi.ts` helper `buildNewTrainingItem` to support optional metadata and card scaffolding.
3. Add helper migration utilities to hydrate legacy items with empty card arrays.

### Phase 2: Manager Authoring Modal (`CurriculumItemEditorModal.tsx`)
1. Create a modern editing modal to replace the cramped inline configuration in `CurriculumSortList.tsx`.
2. Support photo preview/upload, bullet takeaway entry, and card sequencing.
3. Retain drag-and-drop ordering in the main curriculum list.

### Phase 3: Trainee Card Runner (`TrainingCardRunner.tsx`)
1. Build the modal/carousel step runner for trainees.
2. Replace the raw text list in `MyTrainingSection.tsx` with rich card-based modules.
3. Integrate smooth progress dots and checkmark animations matching the Sunny design system tokens (`--ok`, `--surface`, `--surface-sunk`, `--ink`).

---

## 6. Summary Comparison

| Dimension | Current Sunny Implementation | Khan Academy / Microlearning Redesign |
| :--- | :--- | :--- |
| **Content Richness** | Title only (plain string) | Rich visual card: Cover photo, duration, 3-step carousel, takeaways |
| **Learning Format** | Text compliance row | Interactive multi-step visual runner modal |
| **Manager Authoring** | Inline title input + numeric days inputs | Intuitive modular drawer: media, bullet tips, linked checklist questions |
| **Trainee Experience** | "I was trained" button with zero context | Self-paced digestible review before verification |
| **Accountability** | Retrain threshold & inspection miss links | Preserved 100% and directly reinforced with visual guides |
