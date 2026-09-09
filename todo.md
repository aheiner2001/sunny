# Sunny Fleet Management — 10/10 Perfection Roadmap & Findings

> **Purpose**: Detailed breakdown of app findings across key areas, current ratings, and concrete, actionable implementation steps to upgrade every module to a **10/10**.

---

## 📊 Summary Scorecard

| Area | Current Score | Target Score | Primary Gap to 10/10 |
| :--- | :---: | :---: | :--- |
| **Dashboard** | 8.5 / 10 | **10 / 10** | Needs quick filters, urgent vehicle safety alerts & real-time shift toggles |
| **Equipment Lifespan & Tracking** | 9.0 / 10 | **10 / 10** | Needs batch lifecycle actions, audit history log & maintenance forecast estimates |
| **Equipment Inventory Page** | 8.5 / 10 | **10 / 10** | Needs auto-tag generator, minimum par alerts & multi-select transfers |
| **Inspections Workflow** | 8.0 / 10 | **10 / 10** | Needs photo attachments, offline sync indicators & digital signatures |
| **Calendar Layout & Format** | 7.5 / 10 | **10 / 10** | Needs multi-item count badges, scheduled task overlays & week/day view toggles |
| **Reports & Analytics Page** | 7.0 / 10 | **10 / 10** | Needs visual trend charts (SVG/canvas), cost & depreciation metrics, custom date range |
| **Issues Resolution Page** | 8.5 / 10 | **10 / 10** | Needs severity/urgency prioritization triage, assigned mechanic & parts cost tracking |

---

## 1. 🚀 Dashboard (`/dashboard`)
**Current Rating: 8.5 / 10 ➔ Target: 10 / 10**

### 🔍 Current Findings
- Reactively updates with `sunny_db_update` event listener.
- Clean summary metric tiles with direct links.
- Surfaced lifespan action buttons (**Extend**, **Replace**, **Retire**) directly on due equipment cards.
- "Vehicles in Use" table displays active users and start times.

### 🛠️ Action Items to Reach 10/10:
- [ ] **1.1 Activity Stream Filter Chips**: Add quick tabs above "Today's Activity" to toggle `All (default)`, `Inspections Only`, and `Issues Only`.
- [ ] **1.2 Urgent Vehicle Safety Banner**: If a vehicle marked `in_use` had its latest inspection marked `issues_found`, highlight it at the top of the dashboard with an amber/red alert bar.
- [ ] **1.3 Quick Shift Checkout / Return**: Add a quick action button inside the "Vehicles in Use" table to allow managers to release or reassign a vehicle without navigating away.
- [ ] **1.4 Weather / Operations Widget**: Display a small header widget with today's weather/temperature advisory for mobile detailing crews (e.g. freezing alert for pressure washers/water tanks).

---

## 2. ⚙️ Equipment Lifespan & Date Tracking
**Current Rating: 9.0 / 10 ➔ Target: 10 / 10**

### 🔍 Current Findings
- Dual-mode tracking: **Usage Mode** (wears per cars cleaned logged on the vehicle) & **Time Mode** (calendar due dates).
- Clean mathematical status thresholds (`due_for_review` at 100% wear, `getting_low` at 80% wear).
- Individual tool splitting allows bulk stock items to receive individual wear meters and QR tokens.

### 🛠️ Action Items to Reach 10/10:
- [ ] **2.1 Lifespan History & Audit Log**: Store a timeline log on each item whenever it is extended, replaced, or retired (recording timestamp, user ID, previous values, and reason).
- [ ] **2.2 Batch Lifespan Actions**: Add a multi-select checkbox on the "Due for Review" list allowing one-click **"Mark All Selected as Replaced"** (useful for bulk consumables like wash mitts or pads).
- [ ] **2.3 Predictive Wear Forecasting**: Calculate and display estimated days remaining based on the average daily job rate of the assigned van (e.g., *"At current rate of 4 cars/day, this brush will expire in ~12 days"*).
- [ ] **2.4 Custom Low Wear Thresholds**: Allow users to configure warning thresholds per tool type (e.g. alert at 10% remaining for heavy machinery, 30% for high-turnover pads).

---

## 3. 📦 Equipment Inventory Page (`/equipment`)
**Current Rating: 8.5 / 10 ➔ Target: 10 / 10**

### 🔍 Current Findings
- 3 view modes: *By tool family*, *By vehicle*, and *All cards*.
- Individual QR code rendering with print/scan support.
- Restock and vehicle allocation modals.

### 🛠️ Action Items to Reach 10/10:
- [ ] **3.1 Auto-Incremental Asset Tag Generator**: When adding $N$ units of equipment, auto-generate sequential asset tags (e.g. `BRUSH-001`, `BRUSH-002`, `BRUSH-003`).
- [ ] **3.2 Low Stock / Minimum Par Thresholds**: Add a `minRequiredStock` field to shop inventory. Highlight consumable supplies that drop below minimum shop stock in red.
- [ ] **3.3 Multi-Select Inventory Transfers**: Enable selecting multiple different tools at once to transfer to a van in a single action (instead of transferring one item at a time).
- [ ] **3.4 Printable QR Code Sheet**: Add a "Print All QR Labels" button that generates a standard grid sheet (Avery label layout) for all equipment QR codes.

---

## 4. 📋 Inspections Workflow & History (`/inspect` & `/inspections`)
**Current Rating: 8.0 / 10 ➔ Target: 10 / 10**

### 🔍 Current Findings
- Dynamic category & question checklist architecture.
- Draft auto-saving to `localStorage` with recovery prompt.
- Manager rejection loop with flagged correction notices.
- Automatic creation of linked issues upon failed questions.

### 🛠️ Action Items to Reach 10/10:
- [ ] **4.1 Photo Upload / Camera Capture**: Allow operators on mobile to attach a camera photo when reporting an issue or failed checklist item.
- [ ] **4.2 Digital Operator Signature**: Add a touch/mouse canvas signature pad at the end of pre-trip and post-trip submissions.
- [ ] **4.3 Offline Submission Sync Queue**: Show a sticky banner when offline indicating *"1 inspection stored offline — will auto-sync when connection restores"*.
- [ ] **4.4 Odometer & Gas Level Tracking**: Add standard mileage and fuel percentage inputs to pre-trip checklists with automatic delta validation.

---

## 5. 📅 Calendar Layout & Format (`/calendar`)
**Current Rating: 7.5 / 10 ➔ Target: 10 / 10**

### 🔍 Current Findings
- Monthly 7-day grid with color-coded dot badges (green for inspections, orange for issues).
- Side drawer displaying inspection and issue lists for selected day.
- Compact view embedded cleanly into dashboard.

### 🛠️ Action Items to Reach 10/10:
- [ ] **5.1 Multi-Item Numeric Badges**: On tablet/desktop screens, replace single dots with compact count badges (e.g., `3 insp`, `2 issues`).
- [ ] **5.2 Scheduled Fleet Tasks Integration**: Overlay scheduled maintenance tasks, oil changes, and upcoming inspections directly onto future calendar days.
- [ ] **5.3 View Switcher (Month / Week / Day)**: Provide a week-view timeline option for detailed daily scheduling.
- [ ] **5.4 Vehicle Filter on Calendar**: Add a vehicle dropdown filter on the calendar page so managers can view the inspection calendar for a single specific van.

---

## 6. 📈 Reports & Analytics Page (`/reports`)
**Current Rating: 7.0 / 10 ➔ Target: 10 / 10**

### 🔍 Current Findings
- KPI cards for pass rates, issues handled, and fleet size with configurable manager toggles.
- Export options: Inspections CSV, Issues CSV, HTML Compliance Report.

### 🛠️ Action Items to Reach 10/10:
- [ ] **6.1 Interactive Trend Graphs**: Add clean SVG/CSS chart visuals for 30-day inspection pass rate trends and weekly issue volume.
- [ ] **6.2 Custom Date Range Picker**: Allow filtering reports by date range (e.g. *This Week*, *Last 30 Days*, *Custom Range*) instead of all-time aggregation.
- [ ] **6.3 Equipment Cost & Maintenance ROI**: Track replacement costs and calculate total maintenance spend per vehicle over time.
- [ ] **6.4 Operator Reliability Scorecards**: Add an operator leaderboard ranking detailers by inspection completion timeliness and accuracy.

---

## 7. 🔧 Issues Resolution & Timeline Page (`/issues`)
**Current Rating: 8.5 / 10 ➔ Target: 10 / 10**

### 🔍 Current Findings
- Comprehensive lifecycle: `open` ➔ `needs_repair` ➔ `being_repaired` ➔ `fixed`.
- Status change audit timeline with timestamps and manager notes.
- Quick stock remediation actions for inventory shortages directly on issue cards.
- Integrated `RecentInspectors` context.

### 🛠️ Action Items to Reach 10/10:
- [ ] **7.1 Issue Urgency & Priority Triage**: Add a priority selector (`Critical - Van Grounded`, `Moderate - Needs Attention`, `Low - Cosmetic`) and sort critical issues to the top.
- [ ] **7.2 Technician / Mechanic Assignment**: Allow assigning an issue to an internal technician or external vendor with estimated completion dates.
- [ ] **7.3 Cost & Parts Tracking**: Include an optional "Repair Cost" & "Replacement Part #" field when marking an issue as fixed.
- [ ] **7.4 Batch Issue Resolution**: Allow managers to resolve multiple duplicate or minor issues with a single comment.
