# Waypoint school transport

The repository is organized into two application folders:

- `frontend/` contains the Next.js UI, styles, and static assets.
- `backend/` contains the Express API, Prisma schema and seed, Prisma client, and local environment file.

The root contains shared npm tooling and scripts.

## Setup

1. Install dependencies at the repository root with `npm install`.
2. Configure `backend/.env` with `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DRIVER_EMAIL`, and `DRIVER_PASSWORD`.
3. Run `npm run db:generate`, `npm run db:push`, and `npm run db:seed`.
4. Start both applications with `npm run dev`.

The frontend runs at [http://localhost:3000](http://localhost:3000); the Express API runs on port 4001. The frontend proxies `/api/*` to Express.

School admins can add students, create routes and stops, and broadcast announcements. Drivers can view transport data and update trip status. Parents can register and submit student information; their list is scoped to records submitted by their account.

Never commit the real `.env` file or put database credentials in frontend code. `.env.example` is a safe template.
