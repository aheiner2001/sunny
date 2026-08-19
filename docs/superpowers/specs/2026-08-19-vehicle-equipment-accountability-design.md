# Technical Specification & Design: Sunny Fleet Vehicle & Equipment Accountability System

**Date:** 2026-08-19  
**Status:** Approved  
**Author:** Antigravity Team  
**Stack:** Next.js (App Router, TypeScript), Tailwind CSS, Firebase (Auth + Cloud Firestore), Lucide React, HTML5-QRCode / Canvas QR generator.

---

## 1. Overview & Core Philosophy

**Sunny Fleet Accountability System** is a mobile-first web application designed for mobile detailing and automotive service fleets.
The primary goals are:
1. **Frictionless Employee Workflow**: Scan vehicle QR code with camera → auto-resolve vehicle → complete one-handed inspection checklist → flag equipment issues with descriptions → submit.
2. **Instant Manager Visibility**: Dashboard matching the reference design (`image.png`), live calendar of inspections with issue status badges, open issue tracker, deep vehicle & employee usage history, and append-only status change logs.
3. **Immutability & Traceability**: Issue history and equipment status transitions are strictly append-only so managers can trace who reported what, when, which vehicle/equipment was involved, and every step in its resolution.

---

## 2. Firebase Architecture & Data Schema (Cloud Firestore)

The application connects to Firebase project `sunny-cf80c` using Firebase Web SDK v10+.

### 2.1 Collections & Documents

#### `users` (Collection)
- `id` (string, matches Firebase Auth UID):
  - `name`: string (e.g. "Jacob Heiner")
  - `email`: string (e.g. "jacob@sunnyfleet.com")
  - `role`: `'manager' | 'employee'`
  - `status`: `'active' | 'inactive'`
  - `avatarUrl`: string (optional)
  - `createdAt`: timestamp

#### `vehicles` (Collection)
- `id` (string, e.g. "van-1", "van-2"):
  - `vehicleNumber`: string (e.g. "Van #1")
  - `name`: string (e.g. "Ford Transit 250 - Detailing Rig")
  - `licensePlate`: string (e.g. "8U9-SUN")
  - `qrCodeToken`: string (unique identifier for QR scan matching)
  - `status`: `'active' | 'in_use' | 'maintenance' | 'inactive'`
  - `currentUserId`: string | null (FK to users)
  - `currentUserName`: string | null
  - `lastInspectionId`: string | null
  - `lastInspectionStatus`: `'passed' | 'issues_found' | 'in_progress' | null`
  - `lastInspectionAt`: timestamp | null
  - `createdAt`: timestamp

#### `equipment` (Collection)
- `id` (string):
  - `vehicleId`: string (FK to vehicles)
  - `vehicleNumber`: string (e.g. "Van #1")
  - `name`: string (e.g. "Air Compressor", "Vacuum Hose", "Pressure Washer", "Window Squeegee")
  - `category`: `'equipment' | 'supplies' | 'vehicle_condition'`
  - `status`: `'working' | 'flagged' | 'needs_repair' | 'being_repaired' | 'fixed'`
  - `activeIssueId`: string | null
  - `createdAt`: timestamp
  - `updatedAt`: timestamp

#### `checklists` (Collection)
- `id` (string, default "standard-detailing-checklist"):
  - `name`: string (e.g. "Standard Daily Van Inspection")
  - `categories`: array of category sections:
    1. **Equipment** (Air compressor, high-pressure hose, extractor vacuum, steam machine, extension cords)
    2. **Supplies** (Microfiber towels, ceramic coating bottles, interior cleaner, tire shine, trash bags)
    3. **Vehicle Condition** (Dashboard warning lights, exterior body & wrap, tire pressure, windshield & mirrors, fuel level)
    4. **Previous-User Condition** (Cab cleanliness, equipment stowed properly, chemicals wiped down, trash removed)
  - `questions`: array of question definitions:
    - `id`: string
    - `category`: `'equipment' | 'supplies' | 'vehicle_condition' | 'previous_user_condition'`
    - `text`: string
    - `type`: `'pass_fail' | 'yes_no' | 'checkbox' | 'equipment_status' | 'text'`
    - `required`: boolean
    - `equipmentId`: string (optional, linked to equipment item)

#### `inspections` (Collection)
- `id` (string):
  - `vehicleId`: string
  - `vehicleNumber`: string
  - `userId`: string
  - `userName`: string
  - `userEmail`: string
  - `status`: `'passed' | 'issues_found' | 'in_progress'`
  - `startedAt`: timestamp
  - `submittedAt`: timestamp
  - `dateString`: string (YYYY-MM-DD for fast calendar querying)
  - `responses`: array of response objects
  - `issueIds`: array of string (IDs of issues generated in this inspection)
  - `generalNotes`: string (optional)

#### `issues` (Collection)
- `id` (string):
  - `vehicleId`: string
  - `vehicleNumber`: string
  - `equipmentId`: string | null
  - `equipmentName`: string
  - `reportedById`: string
  - `reportedByName`: string
  - `reportedAt`: timestamp
  - `dateString`: string (YYYY-MM-DD)
  - `inspectionId`: string | null
  - `title`: string
  - `description`: string
  - `status`: `'open' | 'needs_repair' | 'being_repaired' | 'fixed'`
  - `resolvedAt`: timestamp | null
  - `resolvedById`: string | null
  - `resolvedByName`: string | null
  - `resolutionNotes`: string | null

#### `issues/{issueId}/status_logs` (Subcollection - Append-Only Audit Trail)
- `id` (string):
  - `issueId`: string
  - `changedById`: string
  - `changedByName`: string
  - `oldStatus`: string
  - `newStatus`: string
  - `notes`: string
  - `timestamp`: timestamp

---

## 3. User Flows & Feature Specifications

### 3.1 Authentication & Role-Based Routing
- Firebase Auth Email/Password + fast Demo switcher (Jacob Heiner - Manager, John Smith - Employee, Sarah Johnson - Employee, Mike Davis - Employee).
- Role-based navigation:
  - **Employee view**: Mobile header with Sunny logo, quick "Scan Vehicle" primary action, active inspection banner, and personal history.
  - **Manager view**: Full responsive sidebar + desktop navigation matching `reference/image.png` (Dashboard, Vehicles, Inspections, Calendar, Equipment, Issues, Employees, Settings).

### 3.2 Employee Inspection Flow (Mobile First)
1. **Camera QR Code Scanner (`/scan`)**:
   - Integrates HTML5-QRCode directly accessing the phone's camera with video viewport and scanning grid.
   - Fallback button: "Demo QR Codes" overlay allowing one-tap camera testing or instant selection for dev/desktop evaluation.
2. **Auto-Identification & Routing**:
   - Scanned QR code decodes vehicle token (e.g. `sunny://vehicle/van-1` or `van-1`) → instantly redirects to `/inspect/[vehicleId]`.
3. **Vehicle Confirmation Card**:
   - Displays Vehicle Number, Model, Current Assigned Equipment, and Previous Inspection status.
4. **Step-by-Step Inspection Checklist**:
   - Organized in 4 clear tabs or segmented sections (Equipment → Supplies → Vehicle Condition → Previous User Condition).
   - Ergonomic large buttons for 1-tap answering (Pass / Fail, Working / Flagged, Yes / No).
   - If an item is marked "Flagged" or "Fail", a quick problem description card unfolds inline to capture details immediately.
5. **Review & Submit**:
   - Summarizes all answered points and open flags.
   - Saves inspection, creates issues, appends initial status logs, and marks vehicle in use.

### 3.3 Manager Dashboard & Deep Historical Views
1. **Main Dashboard (`/dashboard`)**:
   - Exact implementation of the visual reference in `reference/image.png`:
   - Metric stat cards: Total Vehicles (12), Inspections Today (8), Open Issues (5), Vehicles in Use (7).
   - "Today's Activity" chronological feed.
   - "Inspection Calendar" mini-widget with date indicator dots (green for inspections, amber for issues, blue for today).
   - "Open Issues" table widget with colored status badges (`OPEN`, `IN REPAIR`, `FIXED`).
   - "Vehicles in Use" table widget showing Vehicle, Current User, Start Time, Last 
   Inspection status, and In Use status.
   - "Recent Inspections" card.
2. **Vehicle Directory & Detail (`/vehicles`, `/vehicles/[id]`)**:
   - QR Code Generator for each vehicle with instant printable view and download option.
   - Complete Equipment list with current statuses.
   - Unified chronological timeline combining inspections, issue reports, status transitions, and driver assignments.
3. **Interactive Calendar (`/calendar`)**:
   - Month and Day view with date indicators.
   - Clicking any day instantly shows all vehicle inspections and issues recorded on that date.
4. **Flagged Equipment & Issue Manager (`/issues`)**:
   - Filter by vehicle, employee, equipment, date range, and status.
   - Status transition modal appending to the immutable `status_logs` subcollection with manager notes.
5. **Employee Usage Timeline (`/employees`)**:
   - Tracks which employee operated which vehicle across dates, inspection pass rates, and open issues reported.
