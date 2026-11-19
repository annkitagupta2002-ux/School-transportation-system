# Waypoint

Waypoint is a school transportation coordination app for school staff, bus drivers, and families. It brings route progress, student boarding updates, and transport alerts together in one dashboard.

## What Waypoint does

- **Monitor operations:** View route activity, student boarding counts, delays, and fleet status from the overview.
- **Track routes:** Follow route and stop progress, view estimated arrival times, and switch between routes.
- **Coordinate drivers and families:** Update trip status, report delays, record student pickups, and progress a route through its stops.
- **Manage transport details:** Create routes, add stops, and register students with their route, pickup stop, and guardian contact.
- **Send notifications:** Broadcast delay alerts and school transport announcements, then review and mark notifications as read.
- **Use role-based views:** Switch between School Admin, Driver, and Parent perspectives to see relevant transport information and actions.

## Run Waypoint locally

### Requirements

- Node.js 18 or later
- npm

### Start the app

From the project directory, run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data and API

Waypoint is built with Next.js and React. Its API routes provide operations for routes, students, and notifications under `/api`. The current data store is held in memory for the running server session; it is intended for demonstration and resets when the server restarts.

## Try the main workflow

1. Open **Overview** to review route and boarding activity.
2. Open **Live routes** and select a route to view its stops and trip status.
3. Record a pickup or advance the route to simulate progress.
4. Use **Stops & routes** or **Students** to add transport details.
5. Open **Notifications** to review alerts or send an announcement.
