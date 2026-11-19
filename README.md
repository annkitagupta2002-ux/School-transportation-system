# Waypoint — School Transport Coordination Platform
**Build//Break Full-Stack Hackathon 2026 · Challenge 01 / 08**  
**Team Leader:** Ankita Kumari  
**Team Member:** Neha Pramanik  
**Domain:** Education / Mobility  

---

## 1. Problem Analysis & Solution Design (10 Marks)

### The Real-World Challenge
In daily school operations:
1. **Parents** face anxiety not knowing when the school bus will arrive, whether their child was safely picked up or dropped off, or if traffic/breakdowns cause delays.
2. **Drivers** face distractions trying to update parents while navigating traffic and lack an easy, one-tap mechanism to log student pickups and report exceptions.
3. **School Staff & Transport Coordinators** lack central visibility into multi-route fleet progress, student attendance, driver safety checks, and emergency alerts.

### Our Solution Architecture
Waypoint is an end-to-end full-stack coordination suite built with **Next.js**, **React**, and a modular **Node.js API service layer**. It bridges parents, drivers, and coordinators in real time:

- **Overview (Executive Operations Center):** High-level KPIs (active fleet, boarded students, on-time percentage, delay flags), quick dispatch actions, and fleet safety compliance.
- **Live Routes (Real-Time Interactive Tracking):** Illustrated route map with live vehicle positioning, stop sequence progression, driver trip toolbar (Arrived at Stop, Back on Route, Report Delay), and role-tailored parent/driver views.
- **Stops & Routes (Route & Schedule Management):** Stop sequencer with scheduled arrival times, assigned student manifests, "+ Add Stop" modal with real API persistence, and a live "Simulate Next Stop" demo runner.
- **Students (Student Roster & Manifest):** Live student boarding tracker with search, route filtering, status chips (Waiting, Picked Up, Dropped Off, Absent), one-click pickup/absence toggles, and guardian emergency contact modal.
- **Notifications & Broadcast Center:** Multi-channel alert dispatching for delay advisories, boarding receipts, and urgent weather notices with read/unread tracking and filter categories.

---

## 2. Backend APIs & Data Contracts (15 Marks)

Waypoint provides dedicated RESTful endpoints with input validation, appropriate HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `422 Unprocessable Entity`), and error responses:

| Endpoint | Method | Description | Key Parameters / Payload | Status Codes |
| :--- | :---: | :--- | :--- | :--- |
| `/api/route` | `GET` | Fetches consolidated system state, routes, stops, and activity | `?routeId=RTE-008` | `200` |
| `/api/route` | `POST` | Updates route status, marks student picked up, or advances stops | `{ routeId, status, reason, delayMinutes }` or `{ pickedUp }` or `{ action: "advance_stop" }` | `200`, `400`, `422` |
| `/api/routes` | `GET` | Lists all active and scheduled routes with stop counts | None | `200` |
| `/api/routes` | `POST` | Creates a new route or appends a stop to an existing route | `{ action: "add_stop", routeId, name, area, time }` or `{ number, campus, driverName, vehicleReg }` | `201`, `404`, `422` |
| `/api/students` | `GET` | Queries student manifest with filters and counts | `?routeId=...&status=...&search=...` | `200` |
| `/api/students` | `POST` | Registers a new student or updates status (`Picked up`, `Absent`) | `{ name, grade, routeId, stopName, guardianName, guardianPhone }` | `201`, `404`, `422` |
| `/api/notifications` | `GET` | Retrieves live alert feed and unread badge count | `?category=...&unreadOnly=true` | `200` |
| `/api/notifications` | `POST` | Broadcasts a delay alert/announcement or marks as read | `{ title, message, category, audience, tone }` or `{ action: "mark_read", id }` | `201`, `400`, `422` |

---

## 3. Frontend & User Experience (10 Marks)

- **Cohesive Design System:** Built with an accessible palette, subtle elevations, rounded markers, and responsive layouts.
- **Workspace Navigation:**
  1. `Overview`: Operational KPI summary, fleet cards, and compliance tables.
  2. `Live routes`: Illustrated vector route map, stop progress bar, driver controls.
  3. `Stops & routes`: Chronological stop list, arrival times, and stop creation.
  4. `Students`: Searchable manifest table, emergency contact modal, and status indicators.
  5. `Notifications`: Filterable communication feed with unread counters and broadcast modal.
- **Role Switching:** Seamlessly toggle between **School Admin**, **Driver**, and **Parent** perspectives.

---

## 4. Integration & Real-Time Data Flow (10 Marks)

- **Bidirectional State Sync:** Marking a student as "Picked Up" in either the `Students` manifest or `Live routes` stop list automatically updates:
  1. The student's badge and timestamp.
  2. The route's progress bar (e.g. 2 of 4 stops completed).
  3. The `Overview` KPI counters (Students Onboard vs Waiting).
  4. The real-time activity stream and generates an instant family notification.
- **Trip Simulation Engine:** Built-in "Progress stop" and "Simulate Next Stop" buttons let evaluators test the workflow end-to-end without waiting for actual road travel.

---

## 5. Quick Setup & Demo Guide (5 Marks)

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Installation & Run
```bash
# 1. Navigate to the project directory
cd school-transportation-system/school-transportation-system

# 2. Install dependencies (if not already installed)
npm install

# 3. Start the Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Recommended Evaluation Walkthrough:
1. **Overview Tab:** Review top-level KPIs (Active routes, Students onboard, Delay alerts). Click **Add Student** or **Send Announcement**.
2. **Live Routes Tab:** Select **Route 08**. Switch viewing role to **Driver** and click **Picked up** on the current stop, or switch to **Parent** to see the child ETA view.
3. **Stops & Routes Tab:** Click **Simulate Route Progress** to watch the bus move to the next stop, auto-updating arrival estimates and student boarding states. Click **Add Stop to Route** to add a new pickup location.
4. **Students Tab:** Search for "Ishaan" or filter by route. Click **Absent** to simulate a parent calling in sick, or click the phone icon to open the Guardian Contact Modal.
5. **Notifications Tab:** Notice the unread count dot. Read alerts or click **New Broadcast** to dispatch a weather or delay notice across the school. Click **Mark all read** to clear unread badges.

---

## 6. Technical Viva Cheat-Sheet (5 Marks)

- **How is data persisted?** An in-memory data store (`lib/data-store.ts`) singleton mounted on `globalThis` persists routes, students, stops, notifications, and dispatch logs across all Next.js API endpoints during the session.
- **How does error handling work?** Every API endpoint validates input types, required fields, and JSON integrity, returning standard RFC-compliant error payloads (e.g. `{ error: "Validation failed: ..." }`). The React frontend catches errors and displays dismissible toast notifications.
- **How are different user roles handled?** The role switch dynamically adjusts actionable controls: Drivers get stop progression and delay reporting tools; Parents receive ETA highlights and absence reporting; Admins have full dispatch and broadcast privileges.
