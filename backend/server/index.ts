import dotenv from "dotenv";
dotenv.config();
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

const app = express();
app.use(cors({ origin: process.env.APP_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET must be configured before starting the API.");

type UserClaims = { sub: string; role: UserRole; email: string };
type AuthedRequest = Request & { user?: UserClaims };
type RouteStop = { id: string; name: string; area: string; time: string; status: string; student?: string };
const authenticate = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  try { req.user = jwt.verify(token, secret) as UserClaims; next(); }
  catch { return res.status(401).json({ error: "Session expired. Sign in again." }); }
};
const allow = (...roles: UserRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Your role cannot perform this action." });
  next();
};
const asRoute = (r: Prisma.RouteGetPayload<Prisma.RouteDefaultArgs>) => ({ ...r, driver: r.driver, vehicle: r.vehicle, stops: r.stops });
const asStudent = (s: Prisma.StudentGetPayload<Prisma.StudentDefaultArgs>) => ({ ...s, guardian: s.guardian });

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const password = String(req.body?.password || "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Email or password is incorrect." });
  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, { expiresIn: "12h" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
app.post("/api/auth/register-parent", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name || String(password).length < 10) return res.status(422).json({ error: "Name, email, and a password of at least 10 characters are required." });
  try {
    const user = await prisma.user.create({ data: { email: String(email).toLowerCase().trim(), name: String(name).trim(), passwordHash: await bcrypt.hash(String(password), 12), role: UserRole.PARENT } });
    const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, { expiresIn: "12h" });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch { res.status(409).json({ error: "An account with this email already exists." }); }
});
app.get("/api/auth/me", authenticate, (req: AuthedRequest, res) => res.json({ user: req.user }));

app.get("/api/route", authenticate, async (req: AuthedRequest, res) => {
  const [routes, students, notifications, activity] = await Promise.all([
    prisma.route.findMany({ orderBy: { number: "asc" } }),
    prisma.student.findMany({ where: req.user!.role === UserRole.PARENT ? { parentUserId: req.user!.sub } : undefined, orderBy: { name: "asc" } }),
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.activity.findMany({ orderBy: { id: "desc" }, take: 50 }),
  ]);
  const routeId = String(req.query.routeId || routes[0]?.id || "");
  const selectedRoute = routes.find((r) => r.id === routeId) || routes[0];
  res.json({ routeId: selectedRoute?.id, status: selectedRoute?.status, pickedUp: students.filter(s => s.status === "Picked up").map(s => s.name), routes: routes.map(asRoute), students: students.map(asStudent), notifications, activity, unreadNotificationsCount: notifications.filter(n => !n.read).length, selectedRoute: selectedRoute ? asRoute(selectedRoute) : null });
});
app.post("/api/route", authenticate, allow(UserRole.SCHOOL_ADMIN, UserRole.DRIVER), async (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (b.action === "advance_stop") {
    const r = await prisma.route.findUnique({ where: { id: String(b.routeId) } });
    if (!r) return res.status(404).json({ error: "Route not found." });
    const stops = r.stops as unknown as RouteStop[]; const i = r.currentStopIndex + 1;
    if (i < stops.length) { stops[r.currentStopIndex].status = "done"; stops[i].status = "current"; }
    const updated = await prisma.route.update({ where: { id: r.id }, data: { stops, currentStopIndex: Math.min(i, stops.length - 1), ...(i >= stops.length ? { status: "Completed" } : {}) } });
    return res.json({ success: true, route: asRoute(updated) });
  }
  if (b.pickedUp) {
    const student = await prisma.student.findFirst({ where: { name: { equals: String(b.pickedUp), mode: "insensitive" } } });
    if (!student) return res.status(404).json({ error: "Student not found." });
    const updated = await prisma.student.update({ where: { id: student.id }, data: { status: "Picked up", pickupTime: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) } });
    return res.json({ success: true, student: asStudent(updated) });
  }
  if (b.status) {
    const route = await prisma.route.update({ where: { id: String(b.routeId) }, data: { status: String(b.status) } });
    return res.json({ success: true, route: asRoute(route) });
  }
  return res.status(422).json({ error: "Unsupported route action." });
});

app.get("/api/routes", authenticate, async (_req, res) => {
  const routes = await prisma.route.findMany({ orderBy: { number: "asc" } });
  res.json({ routes: routes.map(asRoute), totalRoutes: routes.length, activeRoutes: routes.filter(r => ["On the way", "At stop"].includes(r.status)).length });
});
app.post("/api/routes", authenticate, allow(UserRole.SCHOOL_ADMIN), async (req, res) => {
  const b = req.body || {};
  if (b.action === "add_stop") {
    const route = await prisma.route.findUnique({ where: { id: String(b.routeId || "") } });
    if (!route) return res.status(404).json({ error: "Route not found." });
    const stops = route.stops as unknown as RouteStop[]; const stop = { id: `ST-${Date.now()}`, name: String(b.name || "").trim(), area: String(b.area || "").trim(), time: String(b.time || "").trim(), status: "upcoming", student: b.student || undefined };
    if (!stop.name || !stop.area || !stop.time) return res.status(422).json({ error: "Stop name, landmark, and time are required." });
    stops.push(stop); const updated = await prisma.route.update({ where: { id: route.id }, data: { stops } });
    return res.status(201).json({ success: true, stop, route: asRoute(updated) });
  }
  const { number, campus, driverName, driverPhone, vehicleReg, vehicleModel, capacity } = b;
  if (!number || !campus || !driverName || !vehicleReg) return res.status(422).json({ error: "Route, campus, driver, and vehicle registration are required." });
  const route = await prisma.route.create({ data: { id: `RTE-${Date.now()}`, number: String(number), campus: String(campus), status: "Scheduled", driver: { name: driverName, phone: driverPhone || "", avatar: String(driverName).slice(0, 2).toUpperCase(), verified: true }, vehicle: { reg: vehicleReg, model: vehicleModel || "School bus", capacity: Number(capacity) || 32, inspectionStatus: "Passed" }, eta: "Scheduled departure", stops: [], currentStopIndex: 0 } });
  res.status(201).json({ success: true, route: asRoute(route) });
});

app.get("/api/students", authenticate, async (req: AuthedRequest, res) => {
  const where: Prisma.StudentWhereInput = req.user!.role === UserRole.PARENT ? { parentUserId: req.user!.sub } : {};
  if (req.query.routeId && req.query.routeId !== "all") where.routeId = String(req.query.routeId);
  if (req.query.status && req.query.status !== "all") where.status = { equals: String(req.query.status), mode: "insensitive" };
  if (req.query.search) where.OR = ["name", "grade", "stopName"].map((field) => ({ [field]: { contains: String(req.query.search), mode: "insensitive" } })) as Prisma.StudentWhereInput["OR"];
  const students = await prisma.student.findMany({ where, orderBy: { name: "asc" } });
  res.json({ students: students.map(asStudent), counts: { total: students.length, pickedUp: students.filter(s => s.status === "Picked up").length, waiting: students.filter(s => s.status === "Waiting").length } });
});
app.post("/api/students", authenticate, allow(UserRole.SCHOOL_ADMIN, UserRole.DRIVER, UserRole.PARENT), async (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (b.studentId && req.user!.role !== UserRole.PARENT) {
    const student = await prisma.student.update({ where: { id: String(b.studentId) }, data: { status: String(b.status) } });
    return res.json({ success: true, student: asStudent(student) });
  }
  if (req.user!.role === UserRole.DRIVER) return res.status(403).json({ error: "Drivers can update trip status but cannot register students." });
  const { name, grade, routeId, stopName, guardianName, guardianPhone } = b;
  if (!name || !grade || !routeId || !stopName || !guardianName || !guardianPhone) return res.status(422).json({ error: "Student, grade, route, stop, and guardian details are required." });
  const student = await prisma.student.create({ data: { id: `STU-${Date.now()}`, name: String(name).trim(), grade: String(grade), routeId: String(routeId), stopName: String(stopName), status: "Waiting", guardian: { name: guardianName, phone: guardianPhone, relation: b.guardianRelation || "Parent" }, emergencyContact: String(b.emergencyContact || guardianPhone), notes: b.notes || null, parentUserId: req.user!.role === UserRole.PARENT ? req.user!.sub : null } });
  res.status(201).json({ success: true, student: asStudent(student) });
});

app.get("/api/notifications", authenticate, async (_req, res) => {
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ notifications, unreadCount: notifications.filter(n => !n.read).length, total: notifications.length });
});
app.post("/api/notifications", authenticate, (req: AuthedRequest, res, next) => {
  if (req.body?.action === "mark_read") return allow(UserRole.SCHOOL_ADMIN)(req, res, next);
  return allow(UserRole.SCHOOL_ADMIN)(req, res, next);
}, async (req, res) => {
  const b = req.body || {};
  if (b.action === "mark_read") {
    await prisma.notification.updateMany({ where: b.id ? { id: String(b.id) } : {}, data: { read: true } });
    return res.json({ success: true });
  }
  if (!b.title || !b.message) return res.status(422).json({ error: "Title and message are required." });
  const notification = await prisma.notification.create({ data: { id: `NOTIF-${Date.now()}`, title: String(b.title), message: String(b.message), category: String(b.category || "announcement"), routeId: b.routeId || null, audience: String(b.audience || "All Families & Staff"), time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), tone: String(b.tone || "blue") } });
  await prisma.activity.create({ data: { id: `ACT-${Date.now()}`, icon: "↗", title: notification.title, detail: `${notification.audience} · Broadcast`, time: notification.time, tone: notification.tone, routeId: notification.routeId } });
  res.status(201).json({ success: true, notification });
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  console.error(err); res.status(500).json({ error: "API request failed." });
});
const port = Number(process.env.API_PORT || 4001);
prisma.$connect()
  .then(() => app.listen(port, () => console.log(`Waypoint API connected to PostgreSQL and listening on ${port}`)))
  .catch(() => {
    console.error("Waypoint API could not connect to PostgreSQL. Check DATABASE_URL in backend/.env.");
    process.exit(1);
  });
