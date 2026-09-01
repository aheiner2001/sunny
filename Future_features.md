# Comprehensive Feature Specification: Fleet & Equipment Issue Tracking System with ML Architecture

## Overview
Build a robust issue tracking module for a fleet management web application. This module allows team members to log, track, and resolve equipment and vehicle breakdowns, maintenance requests, and operational issues. It must also capture granular metrics to support future data analytics and machine learning maintenance models.

---

## 1. Data Models & Database Schema (Firebase Firestore)

### Collection: `issues`
Each document in the `issues` collection must include the following fields:
- `id`: string (Auto-generated Firestore ID)
- `dateReported`: timestamp (Server timestamp when logged)
- `vehicleId`: string (e.g., "Van #2")
- `equipmentId`: string (Specific equipment name or asset tag, e.g., "Air Compressor - AC-04")
- `issueTitle`: string (Short title summarizing the issue)
- `description`: string (Detailed description of the problem)
- `type`: enum/string (`"needs_repair"`, `"routine_maintenance"`, `"inspection"`, `"safety"`)
- `status`: enum/string (`"open"`, `"in_progress"`, `"resolved"`, `"closed"`)
- `severity`: enum/string (`"low"`, `"medium"`, `"high"`, `"critical"`) - *Critical/High halts operations.*
- `reportedBy`: string (User ID or name of the person filing the report)
- `odometerOrHours`: number (Vehicle mileage or equipment runtime hours at the time of report)
- `rootCause`: enum/string (`"unassigned"`, `"normal_wear"`, `"operator_error"`, `"manufacturer_defect"`, `"maintenance_omission"`, `"other"`)
- `repairCost`: number (Total cost of parts and labor, default `0`)
- `vendor`: string (Internal team or third-party repair shop name)
- `dateResolved`: timestamp | null (Null when open)
- `resolvedBy`: string | null (Name/ID of the mechanic or team member who fixed it)
- `downtimeHours`: number | null (Calculated automatically upon resolution: difference between `dateReported` and `dateResolved`)

---

## 2. User Interface & Components

### A. Issue Logging Form (Modal or Dedicated Page)
Create a clean, responsive form using **Tailwind CSS** with the following fields:
- **Vehicle Selection:** Dropdown of active fleet vehicles.
- **Equipment Input:** Text input or asset tag selector.
- **Issue Title & Description:** Textarea fields for clear documentation.
- **Severity Selector:** Buttons or dropdown (Low, Medium, High, Critical).
- **Current Odometer / Hours:** Numeric input to track asset wear.
- **Reporter Name:** Auto-populated from the logged-in user profile, with an option to override if reporting on behalf of someone else.

### B. Issue Dashboard / List View
Build an interactive data table or card grid displaying all issues with:
- **Filtering & Search:** Filter by status (`open`, `resolved`), vehicle, severity, and type. Sort by `dateReported` (newest/oldest).
- **Status Badges:** Color-coded visual indicators (e.g., Red for Open/Critical, Yellow for In-Progress, Green for Resolved).
- **Quick Actions:** 
  - Button to **"Start Repair"** (shifts status to `in_progress`).
  - Button to **"Resolve Issue"** (opens a quick modal to input `repairCost`, `rootCause`, `vendor`, and `resolvedBy`).

---

## 3. Business Logic & Automated Calculations
- **Downtime Calculation:** When an issue status is updated to `resolved`, automatically compute `downtimeHours` as the time difference between `dateReported` and the current timestamp, and write it to the document.
- **Validation Rules:** Ensure `repairCost` is a positive number, and require `rootCause` and `repairCost` inputs *before* a ticket can be marked as `resolved`.

---

## 4. Export & Data Preparation for ML
- Implement an **"Export to CSV"** button on the dashboard view that downloads all issue records including metadata (`odometerOrHours`, `downtimeHours`, `repairCost`, `rootCause`, `severity`) so the dataset can easily be plugged into Python/Pandas models later.

---

## 5. Machine Learning & Python Backend Architecture (Optional/Future Expansion)

To support automated data analytics, failure prediction, and text clustering on the issue logs without incurring infrastructure costs, the system can integrate a Python machine learning backend utilizing a zero-cost serverless architecture.

### A. Infrastructure & Hosting (Free Tier Strategy)
- **Database Storage:** Firestore (utilizing the free Spark tier: up to 1 GB data storage and 50k daily reads).
- **ML Processing & API:** **Google Cloud Run** running a containerized **FastAPI** Python service.
  - **Cost Model:** Leverages Cloud Run’s permanent free tier (2 million requests/month and scale-to-zero capabilities, ensuring $0 costs when idle).
- **Alternative (Client-Side ML):** For lightweight models (e.g., decision trees, linear regression, or basic classification), model weights can be exported and executed directly in the Next.js frontend via ONNX Runtime Web or JavaScript ML libraries, completely eliminating the need for a persistent server.

### B. Planned ML Capabilities & Pipelines
1. **Automated NLP Text Clustering:**
   - Automatically group messy or unstructured descriptions in `issueTitle` and `description` into standardized root-cause categories (e.g., "Air Leak", "Electrical Failure") to clean up analytics.
2. **Predictive Maintenance & Failure Forecasting:**
   - Train scikit-learn or XGBoost models on historical logs mapped against `odometerOrHours`, `severity`, and `downtimeHours` to predict impending equipment failures.
3. **Anomaly / "Lemon" Detection:**
   - Flag outlier vehicles or equipment assets that deviate significantly from baseline failure rates or repair costs.
