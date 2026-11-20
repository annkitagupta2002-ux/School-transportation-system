import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const app = express();
const appOrigin = process.env.APP_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: appOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

type SafeUser = { id: string; name: string; email: string; role: UserRole; isActive: boolean };
const secret: jwt.Secret = process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET must be configured before starting the API."); })();
type AuthedRequest = Request & { user?: SafeUser };
const requestUser = (req: Request) => (req as AuthedRequest).user!;
type RouteStopInput = { id?: string; name: string; area: string; time: string; status: string; student?: string };
const routeInclude = {
  assignedDriver: { select: { id: true, name: true, isActive: true } },
  assignedVehicle: true,
  routeStops: { orderBy: { position: "asc" as const } },
};

const trim = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";
const emailValue = (value: unknown) => trim(value, 254).toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const setSessionCookie = (res: Response, token: string) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `waypoint_session=${token}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=43200${secure}`);
};
const clearSessionCookie = (res: Response) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `waypoint_session=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${secure}`);
};
const cookieToken = (req: Request) => {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("waypoint_session="));
  return cookie?.slice("waypoint_session=".length);
};
const paramId = (req: Request) => {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] || "" : value || "";
};
const safeUser = (user: SafeUser) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

async function canonicalAdminId() {
  const config = await prisma.schoolAdminConfig.findUnique({ where: { id: "school" }, select: { userId: true } });
  if (config) return config.userId;
  const admin = await prisma.user.findFirst({ where: { role: UserRole.SCHOOL_ADMIN, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return admin?.id;
}

const authenticate: RequestHandler = async (req, res, next) => {
  const authedReq = req as AuthedRequest;
  const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const sessionCookie = cookieToken(req);
  const tokens = [...new Set([sessionCookie, headerToken].filter((value): value is string => Boolean(value)))];
  if (!tokens.length) return res.status(401).json({ error: "Sign in to continue." });
  let token: string | undefined;
  let claims: jwt.JwtPayload | undefined;
  for (const candidate of tokens) {
    try { claims = jwt.verify(candidate, secret) as jwt.JwtPayload; token = candidate; break; }
    catch { /* Try a legacy bearer token if an old cookie is stale. */ }
  }
  if (!claims || typeof claims.sub !== "string" || !token) return res.status(401).json({ error: "Session expired. Sign in again." });
  const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, name: true, email: true, role: true, isActive: true } });
  if (!user || !user.isActive || user.role !== claims.role) return res.status(401).json({ error: "This account is inactive. Contact the school administrator." });
  if (user.role === UserRole.SCHOOL_ADMIN && (await canonicalAdminId()) !== user.id) return res.status(403).json({ error: "This is not the active School Admin account." });
  authedReq.user = user;
  // Migrate sessions created before the httpOnly cookie was introduced.
  if (token === headerToken && token !== sessionCookie) setSessionCookie(res, token);
  return next();
};

const allow = (...roles: UserRole[]): RequestHandler => (req, res, next) => {
  const user = (req as AuthedRequest).user;
  if (!user || !roles.includes(user.role)) return res.status(403).json({ error: "Your role cannot perform this action." });
  next();
};
const auth: RequestHandler[] = [authenticate];
const adminOnly: RequestHandler[] = [authenticate, allow(UserRole.SCHOOL_ADMIN)];

function asRoute(route: Prisma.RouteGetPayload<{ include: typeof routeInclude }>) {
  const oldDriver = object(route.driver);
  const oldVehicle = object(route.vehicle);
  const driver = route.assignedDriver
    ? { name: route.assignedDriver.name, phone: trim(oldDriver.phone), avatar: trim(oldDriver.avatar) || route.assignedDriver.name.slice(0, 2).toUpperCase(), verified: route.assignedDriver.isActive, id: route.assignedDriver.id }
    : { name: trim(oldDriver.name), phone: trim(oldDriver.phone), avatar: trim(oldDriver.avatar), verified: Boolean(oldDriver.verified) };
  const vehicle = route.assignedVehicle
    ? { reg: route.assignedVehicle.registration, model: route.assignedVehicle.model, capacity: route.assignedVehicle.capacity, inspectionStatus: route.assignedVehicle.inspectionStatus }
    : { reg: trim(oldVehicle.reg, 50), model: trim(oldVehicle.model, 100), capacity: Number(oldVehicle.capacity) || 0, inspectionStatus: trim(oldVehicle.inspectionStatus, 30) };
  const legacyStops = Array.isArray(route.stops) ? route.stops.map((value) => object(value)) : [];
  const stops: RouteStopInput[] = route.routeStops.length
    ? route.routeStops.map((stop) => ({ id: stop.id, name: stop.name, area: stop.area, time: stop.time, status: stop.status, ...(stop.studentName ? { student: stop.studentName } : {}) }))
    : legacyStops.map((stop) => ({ id: trim(stop.id), name: trim(stop.name), area: trim(stop.area), time: trim(stop.time), status: trim(stop.status, 30), ...(trim(stop.student) ? { student: trim(stop.student) } : {}) }));

  return { id: route.id, number: route.number, campus: route.campus, status: route.status, driver, vehicle, eta: route.eta, currentStopIndex: route.currentStopIndex, stops };
}

function asStudent(student: Prisma.StudentGetPayload<Prisma.StudentDefaultArgs>) {
  const guardian = object(student.guardian);
  return {
    id: student.id, name: student.name, grade: student.grade, routeId: student.routeId, stopName: student.stopName,
    status: student.status, pickupTime: student.pickupTime || undefined,
    guardian: { name: trim(guardian.name), phone: trim(guardian.phone), relation: trim(guardian.relation) || "Parent" },
    emergencyContact: student.emergencyContact, notes: student.notes || undefined,
  };
}

function asNotification(notification: Prisma.NotificationGetPayload<{ include: { reads: true } }>, userId: string, role: UserRole) {
  const read = role === UserRole.SCHOOL_ADMIN ? notification.read : notification.reads.length > 0;
  return { id: notification.id, title: notification.title, message: notification.message, category: notification.category, routeId: notification.routeId || undefined, audience: notification.audience, time: notification.time, createdAt: notification.createdAt.toISOString(), read, tone: notification.tone };
}

async function visibleRouteIds(user: SafeUser) {
  if (user.role === UserRole.SCHOOL_ADMIN) return null;
  if (user.role === UserRole.DRIVER) {
    const assigned = await prisma.route.findMany({ where: { driverId: user.id }, select: { id: true } });
    return assigned.map((route) => route.id);
  }
  const students = await prisma.student.findMany({ where: { parentUserId: user.id }, select: { routeId: true } });
  return [...new Set(students.map((student) => student.routeId))];
}

async function visibleRoutes(user: SafeUser) {
  const routeIds = await visibleRouteIds(user);
  if (user.role === UserRole.PARENT && routeIds?.length === 0) {
    // Parents need route names to submit a registration; omit staff and vehicle details.
    const routes = await prisma.route.findMany({ orderBy: { number: "asc" }, include: routeInclude });
    return routes.map((route) => ({ ...asRoute(route), driver: { name: "", phone: "", avatar: "", verified: false }, vehicle: { reg: "", model: "", capacity: 0, inspectionStatus: "Pending" }, stops: [] }));
  }
  const routes = await prisma.route.findMany({ where: routeIds ? { id: { in: routeIds } } : undefined, orderBy: { number: "asc" }, include: routeInclude });
  if (user.role !== UserRole.PARENT) return routes.map(asRoute);
  const students = await prisma.student.findMany({ where: { parentUserId: user.id }, select: { name: true } });
  const studentNames = new Set(students.map((student) => student.name.toLocaleLowerCase()));
  return routes.map((route) => {
    const view = asRoute(route);
    return {
      ...view,
      driver: { ...view.driver, phone: "" },
      stops: view.stops.map((stop) => stop.student && !studentNames.has(stop.student.toLocaleLowerCase()) ? { ...stop, student: undefined } : stop),
    };
  });
}

async function visibleNotifications(user: SafeUser, routeIds: string[] | null) {
  const audience = user.role === UserRole.PARENT ? { contains: "famil", mode: "insensitive" as const } : { contains: "driver", mode: "insensitive" as const };
  const where: Prisma.NotificationWhereInput = user.role === UserRole.SCHOOL_ADMIN
    ? {}
    : { OR: [{ routeId: null, audience }, ...(routeIds?.length ? [{ routeId: { in: routeIds } }] : [])] };
  const notifications = await prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { reads: { where: { userId: user.id } } } });
  return notifications.map((notification) => asNotification(notification, user.id, user.role));
}

async function dashboardData(user: SafeUser, selectedRouteId?: string) {
  const routeIds = await visibleRouteIds(user);
  const [allRoutes, students, notifications, activity] = await Promise.all([
    visibleRoutes(user),
    prisma.student.findMany({ where: user.role === UserRole.PARENT ? { parentUserId: user.id } : routeIds ? { routeId: { in: routeIds } } : undefined, orderBy: { name: "asc" } }),
    visibleNotifications(user, routeIds),
    prisma.activity.findMany({ where: user.role === UserRole.SCHOOL_ADMIN ? undefined : routeIds?.length ? { routeId: { in: routeIds } } : { routeId: "" }, orderBy: { id: "desc" }, take: 50 }),
  ]);
  const chosen = allRoutes.find((route) => route.id === selectedRouteId) || allRoutes[0];
  return {
    routeId: chosen?.id, status: chosen?.status, pickedUp: students.filter((student) => student.status === "Picked up").map((student) => student.name),
    routes: allRoutes, students: students.map(asStudent), notifications,
    activity: activity.map((item) => ({ id: item.id, icon: item.icon, title: item.title, detail: item.detail, time: item.time, createdAt: item.createdAt?.toISOString(), tone: item.tone, routeId: item.routeId || undefined })),
    unreadNotificationsCount: notifications.filter((notification) => !notification.read).length,
    selectedRoute: chosen || null,
  };
}

async function requireRouteAccess(user: SafeUser, routeId: string) {
  const route = await prisma.route.findUnique({ where: { id: routeId }, include: routeInclude });
  if (!route) return { error: "Route not found." as const };
  if (user.role === UserRole.DRIVER && route.driverId !== user.id) return { forbidden: true as const };
  if (user.role === UserRole.PARENT) {
    const hasStudent = await prisma.student.findFirst({ where: { routeId, parentUserId: user.id }, select: { id: true } });
    if (!hasStudent) return { forbidden: true as const };
  }
  return { route };
}

function makeId(prefix: string) { return `${prefix}-${randomUUID()}`; }

async function updateRouteStops(routeId: string, stops: RouteStopInput[]) {
  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < stops.length; index += 1) {
      const stop = stops[index];
      const legacyId = stop.id || makeId("ST");
      const existing = await tx.routeStop.findFirst({ where: { routeId, OR: [{ id: legacyId }, { legacyId }] } });
      if (existing) {
        await tx.routeStop.update({ where: { id: existing.id }, data: { name: stop.name, area: stop.area, time: stop.time, status: stop.status, studentName: stop.student || null, position: index } });
      } else {
        await tx.routeStop.create({ data: { routeId, legacyId, name: stop.name, area: stop.area, time: stop.time, status: stop.status, studentName: stop.student || null, position: index } });
      }
    }
    const savedStops = await tx.routeStop.findMany({ where: { routeId }, orderBy: { position: "asc" } });
    const legacyStops = savedStops.map((stop) => ({ id: stop.legacyId || stop.id, name: stop.name, area: stop.area, time: stop.time, status: stop.status, ...(stop.studentName ? { student: stop.studentName } : {}) }));
    await tx.route.update({ where: { id: routeId }, data: { stops: legacyStops as unknown as Prisma.InputJsonValue } });
  });
}

async function saveStudentStatus(studentId: string, status: string) {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.update({
      where: { id: studentId },
      data: { status, ...(status === "Picked up" ? { pickupTime: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) } : {}) },
    });
    const route = await tx.route.findUnique({ where: { id: student.routeId }, select: { number: true } });
    if (route && status !== "Waiting") {
      const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const category = status === "Picked up" || status === "Dropped off" ? "pickup" : "announcement";
      const tone = status === "Picked up" || status === "Dropped off" ? "green" : "amber";
      const title = `${student.name} ${status.toLowerCase()}`;
      const audience = `Route ${route.number} Families & Drivers`;
      await tx.notification.create({ data: { id: makeId("NOTIF"), title, message: `${student.name} is marked ${status.toLowerCase()} on ${route.number}.`, category, routeId: student.routeId, audience, time, tone } });
      await tx.activity.create({ data: { id: makeId("ACT"), icon: status === "Absent" ? "!" : "✓", title, detail: route.number, time, tone, routeId: student.routeId, createdAt: new Date() } });
    }
    return student;
  });
}

// Authentication and parent profiles
app.post("/api/auth/login", async (req, res) => {
  const email = emailValue(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isEmail(email) || !password) return res.status(422).json({ error: "Enter a valid email and password." });
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Email or password is incorrect." });
  if (req.body?.expectedRole && req.body.expectedRole !== user.role) return res.status(403).json({ error: "This account is not registered for that login option." });
  if (user.role === UserRole.SCHOOL_ADMIN && (await canonicalAdminId()) !== user.id) return res.status(403).json({ error: "This is not the active School Admin account." });
  const token = jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: "12h" });
  setSessionCookie(res, token);
  return res.json({ user: safeUser(user) });
});

app.post("/api/auth/logout", (_req, res) => { clearSessionCookie(res); res.json({ success: true }); });

app.post("/api/auth/register-parent", async (req, res) => {
  const email = emailValue(req.body?.email);
  const name = trim(req.body?.name, 120);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!name || !isEmail(email) || password.length < 10 || password.length > 200) return res.status(422).json({ error: "Enter your name, a valid email, and a password of 10–200 characters." });
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) return res.status(409).json({ error: "An account with this email already exists." });
  try {
    const user = await prisma.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 12), role: UserRole.PARENT } });
    const token = jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: "12h" });
    setSessionCookie(res, token);
    return res.status(201).json({ user: safeUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "An account with this email already exists." });
    throw error;
  }
});

app.get("/api/auth/me", ...auth, (req: Request, res) => res.json({ user: safeUser(requestUser(req)) }));
app.patch("/api/auth/me", ...auth, async (req: Request, res) => {
  const name = req.body?.name === undefined ? undefined : trim(req.body.name, 120);
  const email = req.body?.email === undefined ? undefined : emailValue(req.body.email);
  if (name === "" || (email !== undefined && !isEmail(email))) return res.status(422).json({ error: "Enter a valid name and email." });
  try {
    const user = await prisma.user.update({ where: { id: requestUser(req).id }, data: { ...(name ? { name } : {}), ...(email ? { email } : {}) }, select: { id: true, name: true, email: true, role: true, isActive: true } });
    return res.json({ user: safeUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "An account with this email already exists." });
    throw error;
  }
});

// Combined dashboard load, with route, student, activity, and notice scope applied by role.
app.get("/api/route", ...auth, async (req: Request, res) => res.json(await dashboardData(requestUser(req), trim(req.query.routeId, 100))));

// Admin-managed driver accounts. DELETE intentionally deactivates and retains history.
app.get("/api/drivers", ...adminOnly, async (_req, res) => {
  const drivers = await prisma.user.findMany({ where: { role: UserRole.DRIVER }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isActive: true, driverRoutes: { select: { id: true, number: true } } } });
  res.json({ drivers: drivers.map((driver) => ({ id: driver.id, name: driver.name, email: driver.email, isActive: driver.isActive, routes: driver.driverRoutes })) });
});

app.post("/api/drivers", ...adminOnly, async (req, res) => {
  const name = trim(req.body?.name, 120);
  const email = emailValue(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!name || !isEmail(email) || password.length < 10 || password.length > 200) return res.status(422).json({ error: "Enter a name, valid email, and password of 10–200 characters." });
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) return res.status(409).json({ error: "An account with this email already exists." });
  const routeId = trim(req.body?.routeId, 100);
  if (routeId && !await prisma.route.findUnique({ where: { id: routeId }, select: { id: true } })) return res.status(422).json({ error: "Select an existing route." });
  try {
    const driver = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: UserRole.DRIVER } });
    if (routeId) await prisma.route.update({ where: { id: routeId }, data: { driverId: driver.id } });
    return res.status(201).json({ driver: { id: driver.id, name: driver.name, email: driver.email, isActive: driver.isActive } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "An account with this email already exists." });
    throw error;
  }
});

app.patch("/api/drivers/:id", ...adminOnly, async (req, res) => {
  const current = await prisma.user.findFirst({ where: { id: paramId(req), role: UserRole.DRIVER }, select: { id: true } });
  if (!current) return res.status(404).json({ error: "Driver account not found." });
  const name = req.body?.name === undefined ? undefined : trim(req.body.name, 120);
  const email = req.body?.email === undefined ? undefined : emailValue(req.body.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (name === "" || (email !== undefined && !isEmail(email)) || (password && (password.length < 10 || password.length > 200))) return res.status(422).json({ error: "Check the driver name, email, and password (10–200 characters)." });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const driver = await tx.user.update({ where: { id: current.id }, data: { ...(name ? { name } : {}), ...(email ? { email } : {}), ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}), ...(typeof req.body?.isActive === "boolean" ? { isActive: req.body.isActive } : {}) }, select: { id: true, name: true, email: true, isActive: true } });
      if (req.body?.routeId !== undefined) {
        const routeId = trim(req.body.routeId, 100);
        await tx.route.updateMany({ where: { driverId: current.id }, data: { driverId: null } });
        if (routeId) {
          const route = await tx.route.findUnique({ where: { id: routeId }, select: { id: true } });
          if (!route) throw new Error("Select an existing route.");
          await tx.route.update({ where: { id: routeId }, data: { driverId: current.id } });
        }
      }
      return driver;
    });
    return res.json({ driver: result });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "An account with this email already exists." });
    if (error instanceof Error && error.message === "Select an existing route.") return res.status(422).json({ error: error.message });
    throw error;
  }
});

app.delete("/api/drivers/:id", ...adminOnly, async (req, res) => {
  const result = await prisma.user.updateMany({ where: { id: paramId(req), role: UserRole.DRIVER }, data: { isActive: false } });
  if (!result.count) return res.status(404).json({ error: "Driver account not found." });
  return res.json({ success: true, deactivated: true });
});

// Routes and stop records. Legacy JSON is mirrored until every consumer uses relations.
app.get("/api/routes", ...auth, async (req: Request, res) => {
  const routes = await visibleRoutes(requestUser(req));
  res.json({ routes, totalRoutes: routes.length, activeRoutes: routes.filter((route) => ["On the way", "At stop"].includes(route.status)).length });
});

async function routeInput(req: Request, existing?: Prisma.RouteGetPayload<Prisma.RouteDefaultArgs>) {
  const body = req.body || {};
  const number = body.number === undefined && existing ? existing.number : trim(body.number, 80);
  const campus = body.campus === undefined && existing ? existing.campus : trim(body.campus, 120);
  const status = body.status === undefined && existing ? existing.status : trim(body.status, 40);
  const eta = body.eta === undefined && existing ? existing.eta : trim(body.eta, 80);
  const vehicleReg = body.vehicleReg === undefined ? (existing ? trim(object(existing.vehicle).reg, 50) : "") : trim(body.vehicleReg, 50).toUpperCase();
  const vehicleModel = body.vehicleModel === undefined ? (existing ? trim(object(existing.vehicle).model, 100) : "School bus") : trim(body.vehicleModel, 100);
  const capacity = body.capacity === undefined ? (existing ? Number(object(existing.vehicle).capacity) || 32 : 32) : Number(body.capacity);
  const driverId = body.driverId === undefined ? existing?.driverId || null : trim(body.driverId, 100) || null;
  if (!number || !campus || (status && !["Scheduled", "On the way", "At stop", "Completed", "Delayed"].includes(status)) || !vehicleReg || !vehicleModel || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) return { error: "Route, campus, vehicle registration, model, and a valid capacity are required." } as const;
  const driver = driverId ? await prisma.user.findFirst({ where: { id: driverId, role: UserRole.DRIVER, isActive: true }, select: { id: true, name: true } }) : null;
  if (driverId && !driver) return { error: "Select an active driver account." } as const;
  const vehicle = await prisma.vehicle.upsert({
    where: { registration: vehicleReg },
    update: { model: vehicleModel, capacity, inspectionStatus: trim(body.inspectionStatus, 30) || "Passed" },
    create: { registration: vehicleReg, model: vehicleModel, capacity, inspectionStatus: trim(body.inspectionStatus, 30) || "Passed" },
  });
  const oldDriver = existing ? object(existing.driver) : {};
  const driverJson = driver
    ? { name: driver.name, phone: trim(body.driverPhone, 40) || trim(oldDriver.phone, 40), avatar: driver.name.slice(0, 2).toUpperCase(), verified: true }
    : body.driverName ? { name: trim(body.driverName, 120), phone: trim(body.driverPhone, 40), avatar: trim(body.driverName, 2).toUpperCase(), verified: false } : existing?.driver;
  return { number, campus, status: status || "Scheduled", eta: eta || "Scheduled departure", vehicle, driverId, driverJson, vehicleJson: { reg: vehicleReg, model: vehicleModel, capacity, inspectionStatus: vehicle.inspectionStatus } } as const;
}

app.post("/api/routes", ...adminOnly, async (req, res) => {
  const body = req.body || {};
  if (body.action === "add_stop") {
    const routeId = trim(body.routeId, 100);
    const route = await prisma.route.findUnique({ where: { id: routeId }, include: routeInclude });
    if (!route) return res.status(404).json({ error: "Route not found." });
    const name = trim(body.name, 120); const area = trim(body.area, 180); const time = trim(body.time, 50);
    if (!name || !area || !time) return res.status(422).json({ error: "Stop name, landmark, and time are required." });
    const stop: RouteStopInput = { id: makeId("ST"), name, area, time, status: "upcoming", ...(trim(body.student, 120) ? { student: trim(body.student, 120) } : {}) };
    const currentStops = route.routeStops.length ? asRoute(route).stops : (Array.isArray(route.stops) ? route.stops as unknown as RouteStopInput[] : []);
    await updateRouteStops(route.id, [...currentStops, stop]);
    const updated = await prisma.route.findUniqueOrThrow({ where: { id: route.id }, include: routeInclude });
    return res.status(201).json({ success: true, stop, route: asRoute(updated) });
  }
  const parsed = await routeInput(req);
  if ("error" in parsed) return res.status(422).json({ error: parsed.error });
  const driverData = parsed.driverJson || { name: "Unassigned", phone: "", avatar: "--", verified: false };
  const route = await prisma.route.create({
    data: { id: makeId("RTE"), number: parsed.number, campus: parsed.campus, status: parsed.status, driver: driverData as Prisma.InputJsonValue, vehicle: parsed.vehicleJson, eta: parsed.eta, currentStopIndex: 0, stops: [], driverId: parsed.driverId, vehicleId: parsed.vehicle.id },
    include: routeInclude,
  });
  return res.status(201).json({ success: true, route: asRoute(route) });
});

app.patch("/api/routes/:id", ...adminOnly, async (req, res) => {
  const existing = await prisma.route.findUnique({ where: { id: paramId(req) } });
  if (!existing) return res.status(404).json({ error: "Route not found." });
  const parsed = await routeInput(req, existing);
  if ("error" in parsed) return res.status(422).json({ error: parsed.error });
  const updated = await prisma.route.update({
    where: { id: existing.id },
    data: { number: parsed.number, campus: parsed.campus, status: parsed.status, eta: parsed.eta, driver: (parsed.driverJson || existing.driver) as Prisma.InputJsonValue, vehicle: parsed.vehicleJson, driverId: parsed.driverId, vehicleId: parsed.vehicle.id },
    include: routeInclude,
  });
  return res.json({ success: true, route: asRoute(updated) });
});

app.delete("/api/routes/:id", ...adminOnly, async (req, res) => {
  const route = await prisma.route.findUnique({ where: { id: paramId(req) }, select: { id: true } });
  if (!route) return res.status(404).json({ error: "Route not found." });
  if (await prisma.student.count({ where: { routeId: route.id } })) return res.status(409).json({ error: "Move or remove assigned students before deleting this route." });
  await prisma.$transaction([
    prisma.notification.updateMany({ where: { routeId: route.id }, data: { routeId: null } }),
    prisma.activity.updateMany({ where: { routeId: route.id }, data: { routeId: null } }),
    prisma.route.delete({ where: { id: route.id } }),
  ]);
  return res.json({ success: true });
});

app.patch("/api/stops/:id", ...adminOnly, async (req, res) => {
  const routeId = trim(req.body?.routeId, 100);
  const existing = await prisma.routeStop.findUnique({ where: { id: paramId(req) } }) || (routeId ? await prisma.routeStop.findFirst({ where: { routeId, legacyId: paramId(req) } }) : null);
  if (!existing) return res.status(404).json({ error: "Stop not found." });
  const name = req.body?.name === undefined ? existing.name : trim(req.body.name, 120);
  const area = req.body?.area === undefined ? existing.area : trim(req.body.area, 180);
  const time = req.body?.time === undefined ? existing.time : trim(req.body.time, 50);
  const status = req.body?.status === undefined ? existing.status : trim(req.body.status, 30);
  if (!name || !area || !time || !["done", "current", "upcoming"].includes(status)) return res.status(422).json({ error: "Provide a valid stop name, landmark, time, and status." });
  const updated = await prisma.routeStop.update({ where: { id: existing.id }, data: { name, area, time, status, studentName: req.body?.student === undefined ? existing.studentName : trim(req.body.student, 120) || null } });
  const route = await prisma.route.findUniqueOrThrow({ where: { id: updated.routeId }, include: routeInclude });
  await updateRouteStops(route.id, route.routeStops.map((stop) => ({ id: stop.id, name: stop.name, area: stop.area, time: stop.time, status: stop.status, ...(stop.studentName ? { student: stop.studentName } : {}) })));
  return res.json({ success: true, route: asRoute(await prisma.route.findUniqueOrThrow({ where: { id: route.id }, include: routeInclude })) });
});

app.delete("/api/stops/:id", ...adminOnly, async (req, res) => {
  const routeId = trim(req.query.routeId, 100);
  const stop = await prisma.routeStop.findUnique({ where: { id: paramId(req) } }) || (routeId ? await prisma.routeStop.findFirst({ where: { routeId, legacyId: paramId(req) } }) : null);
  if (!stop) return res.status(404).json({ error: "Stop not found." });
  await prisma.routeStop.delete({ where: { id: stop.id } });
  const route = await prisma.route.findUniqueOrThrow({ where: { id: stop.routeId }, include: routeInclude });
  await updateRouteStops(route.id, route.routeStops.map((item) => ({ id: item.id, name: item.name, area: item.area, time: item.time, status: item.status, ...(item.studentName ? { student: item.studentName } : {}) })));
  return res.json({ success: true });
});

// Vehicle data is normalized and can be managed independently.
app.get("/api/vehicles", ...adminOnly, async (_req, res) => {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { registration: "asc" }, include: { routes: { select: { id: true, number: true } } } });
  res.json({ vehicles });
});
app.post("/api/vehicles", ...adminOnly, async (req, res) => {
  const registration = trim(req.body?.registration, 50).toUpperCase(); const model = trim(req.body?.model, 100); const capacity = Number(req.body?.capacity);
  if (!registration || !model || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) return res.status(422).json({ error: "Enter a registration, model, and capacity from 1 to 100." });
  try { return res.status(201).json({ vehicle: await prisma.vehicle.create({ data: { registration, model, capacity, inspectionStatus: trim(req.body?.inspectionStatus, 30) || "Pending" } }) }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "A vehicle with this registration already exists." }); throw error; }
});
app.patch("/api/vehicles/:id", ...adminOnly, async (req, res) => {
  const registration = req.body?.registration === undefined ? undefined : trim(req.body.registration, 50).toUpperCase();
  const model = req.body?.model === undefined ? undefined : trim(req.body.model, 100);
  const capacity = req.body?.capacity === undefined ? undefined : Number(req.body.capacity);
  if (registration === "" || model === "" || (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100))) return res.status(422).json({ error: "Enter a valid registration, model, and capacity from 1 to 100." });
  try { return res.json({ vehicle: await prisma.vehicle.update({ where: { id: paramId(req) }, data: { ...(registration ? { registration } : {}), ...(model ? { model } : {}), ...(capacity !== undefined ? { capacity } : {}), ...(req.body?.inspectionStatus ? { inspectionStatus: trim(req.body.inspectionStatus, 30) } : {}) } }) }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "A vehicle with this registration already exists." }); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ error: "Vehicle not found." }); throw error; }
});
app.delete("/api/vehicles/:id", ...adminOnly, async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: paramId(req) }, include: { routes: { select: { id: true } } } });
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found." });
  if (vehicle.routes.length) return res.status(409).json({ error: "Unassign this vehicle from its routes before deleting it." });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  return res.json({ success: true });
});

// Student records and trip status.
app.get("/api/students", ...auth, async (req: Request, res) => {
  const routeIds = await visibleRouteIds(requestUser(req));
  const where: Prisma.StudentWhereInput = requestUser(req).role === UserRole.PARENT ? { parentUserId: requestUser(req).id } : routeIds ? { routeId: { in: routeIds } } : {};
  if (req.query.routeId && req.query.routeId !== "all") where.routeId = String(req.query.routeId);
  if (req.query.status && req.query.status !== "all") where.status = { equals: String(req.query.status), mode: "insensitive" };
  if (req.query.search) where.OR = ["name", "grade", "stopName"].map((field) => ({ [field]: { contains: String(req.query.search), mode: "insensitive" } })) as Prisma.StudentWhereInput["OR"];
  const students = await prisma.student.findMany({ where, orderBy: { name: "asc" } });
  res.json({ students: students.map(asStudent), counts: { total: students.length, pickedUp: students.filter((student) => student.status === "Picked up").length, waiting: students.filter((student) => student.status === "Waiting").length } });
});

app.post("/api/students", ...auth, async (req: Request, res) => {
  const body = req.body || {};
  if (body.studentId) {
    const status = trim(body.status, 30);
    if (!["Waiting", "Picked up", "Dropped off", "Absent"].includes(status)) return res.status(422).json({ error: "Choose a valid student trip status." });
    const student = await prisma.student.findUnique({ where: { id: trim(body.studentId, 100) } });
    if (!student) return res.status(404).json({ error: "Student not found." });
    if (requestUser(req).role === UserRole.DRIVER) {
      const assignment = await prisma.route.findFirst({ where: { id: student.routeId, driverId: requestUser(req).id }, select: { id: true } });
      if (!assignment) return res.status(403).json({ error: "You can update students on your assigned routes only." });
    } else if (requestUser(req).role === UserRole.PARENT) {
      if (student.parentUserId !== requestUser(req).id || status !== "Absent") return res.status(403).json({ error: "Parents can mark their own students absent only." });
    } else if (requestUser(req).role !== UserRole.SCHOOL_ADMIN) return res.status(403).json({ error: "You cannot change this student status." });
    const updated = await saveStudentStatus(student.id, status);
    return res.json({ success: true, student: asStudent(updated) });
  }
  if (requestUser(req).role !== UserRole.SCHOOL_ADMIN && requestUser(req).role !== UserRole.PARENT) return res.status(403).json({ error: "Drivers cannot register students." });
  const name = trim(body.name, 120); const grade = trim(body.grade, 40); const routeId = trim(body.routeId, 100); const stopName = trim(body.stopName, 120);
  const guardianName = trim(body.guardianName, 120); const guardianPhone = trim(body.guardianPhone, 40);
  if (!name || !grade || !routeId || !stopName || !guardianName || !guardianPhone) return res.status(422).json({ error: "Student, grade, route, stop, and guardian details are required." });
  const route = await prisma.route.findUnique({ where: { id: routeId }, select: { id: true } });
  if (!route) return res.status(422).json({ error: "Select an existing route." });
  const student = await prisma.student.create({ data: { id: makeId("STU"), name, grade, routeId, stopName, status: "Waiting", guardian: { name: guardianName, phone: guardianPhone, relation: trim(body.guardianRelation, 50) || "Parent" }, emergencyContact: trim(body.emergencyContact, 40) || guardianPhone, notes: trim(body.notes, 500) || null, parentUserId: requestUser(req).role === UserRole.PARENT ? requestUser(req).id : null } });
  return res.status(201).json({ success: true, student: asStudent(student) });
});

app.patch("/api/students/:id", ...auth, async (req: Request, res) => {
  const existing = await prisma.student.findUnique({ where: { id: paramId(req) } });
  if (!existing) return res.status(404).json({ error: "Student not found." });
  if (requestUser(req).role === UserRole.DRIVER) {
    const assigned = await prisma.route.findFirst({ where: { id: existing.routeId, driverId: requestUser(req).id }, select: { id: true } });
    if (!assigned) return res.status(403).json({ error: "You can update students on your assigned routes only." });
    const status = trim(req.body?.status, 30);
    if (!["Waiting", "Picked up", "Dropped off", "Absent"].includes(status)) return res.status(422).json({ error: "Choose a valid student trip status." });
    const student = await saveStudentStatus(existing.id, status);
    return res.json({ success: true, student: asStudent(student) });
  }
  if (requestUser(req).role === UserRole.PARENT) {
    if (existing.parentUserId !== requestUser(req).id || trim(req.body?.status, 30) !== "Absent") return res.status(403).json({ error: "Parents can mark their own students absent only." });
    const student = await saveStudentStatus(existing.id, "Absent");
    return res.json({ success: true, student: asStudent(student) });
  }
  if (requestUser(req).role !== UserRole.SCHOOL_ADMIN) return res.status(403).json({ error: "Only the School Admin can edit student records." });
  const body = req.body || {}; const guardian = object(existing.guardian);
  const name = body.name === undefined ? existing.name : trim(body.name, 120);
  const grade = body.grade === undefined ? existing.grade : trim(body.grade, 40);
  const routeId = body.routeId === undefined ? existing.routeId : trim(body.routeId, 100);
  const stopName = body.stopName === undefined ? existing.stopName : trim(body.stopName, 120);
  if (!name || !grade || !routeId || !stopName) return res.status(422).json({ error: "Student, grade, route, and pickup stop are required." });
  if (body.status !== undefined && !["Waiting", "Picked up", "Dropped off", "Absent"].includes(trim(body.status, 30))) return res.status(422).json({ error: "Choose a valid student status." });
  if (routeId !== existing.routeId && !await prisma.route.findUnique({ where: { id: routeId }, select: { id: true } })) return res.status(422).json({ error: "Select an existing route." });
  const updated = await prisma.student.update({ where: { id: existing.id }, data: {
    name, grade, routeId, stopName,
    ...(body.status === undefined ? {} : { status: trim(body.status, 30) }),
    ...(body.guardianName === undefined && body.guardianPhone === undefined && body.guardianRelation === undefined ? {} : { guardian: { name: trim(body.guardianName, 120) || trim(guardian.name, 120), phone: trim(body.guardianPhone, 40) || trim(guardian.phone, 40), relation: trim(body.guardianRelation, 50) || trim(guardian.relation, 50) || "Parent" } }),
    ...(body.emergencyContact === undefined ? {} : { emergencyContact: trim(body.emergencyContact, 40) }),
    ...(body.notes === undefined ? {} : { notes: trim(body.notes, 500) || null }),
  } });
  return res.json({ success: true, student: asStudent(updated) });
});

app.delete("/api/students/:id", ...adminOnly, async (req, res) => {
  const result = await prisma.student.deleteMany({ where: { id: paramId(req) } });
  if (!result.count) return res.status(404).json({ error: "Student not found." });
  return res.json({ success: true });
});

// Route movement / status actions. Drivers are constrained to their own assigned route.
app.post("/api/route", ...auth, async (req: Request, res) => {
  const body = req.body || {}; const routeId = trim(body.routeId, 100);
  if (body.pickedUp) {
    const student = await prisma.student.findFirst({ where: { name: { equals: trim(body.pickedUp, 120), mode: "insensitive" }, ...(requestUser(req).role === UserRole.PARENT ? { parentUserId: requestUser(req).id } : {}) } });
    if (!student) return res.status(404).json({ error: "Student not found." });
    if (requestUser(req).role === UserRole.DRIVER && !await prisma.route.findFirst({ where: { id: student.routeId, driverId: requestUser(req).id }, select: { id: true } })) return res.status(403).json({ error: "You can update your assigned route only." });
    if (requestUser(req).role === UserRole.PARENT) return res.status(403).json({ error: "Parents cannot change trip status." });
    const updated = await saveStudentStatus(student.id, "Picked up");
    return res.json({ success: true, student: asStudent(updated) });
  }
  if (!routeId) return res.status(422).json({ error: "Route ID is required." });
  const access = await requireRouteAccess(requestUser(req), routeId);
  if ("error" in access) return res.status(404).json({ error: access.error });
  if ("forbidden" in access) return res.status(403).json({ error: "You cannot access this route." });
  if (body.action === "advance_stop") {
    if (requestUser(req).role !== UserRole.SCHOOL_ADMIN && requestUser(req).role !== UserRole.DRIVER) return res.status(403).json({ error: "Parents cannot update route progress." });
    const route = access.route;
    const stops = route.routeStops.length ? asRoute(route).stops : Array.isArray(route.stops) ? route.stops as unknown as RouteStopInput[] : [];
    if (!stops.length) return res.status(409).json({ error: "This route has no stops to advance." });
    const next = Math.min(route.currentStopIndex + 1, stops.length - 1);
    if (route.currentStopIndex >= 0 && route.currentStopIndex < stops.length) stops[route.currentStopIndex].status = "done";
    stops[next].status = next === route.currentStopIndex ? stops[next].status : "current";
    await updateRouteStops(route.id, stops);
    const updated = await prisma.route.update({ where: { id: route.id }, data: { currentStopIndex: next, ...(next === stops.length - 1 ? { status: "Completed" } : {}), ...(next < stops.length - 1 ? { status: "On the way" } : {}) }, include: routeInclude });
    return res.json({ success: true, route: asRoute(updated) });
  }
  if (body.status) {
    if (requestUser(req).role !== UserRole.SCHOOL_ADMIN && requestUser(req).role !== UserRole.DRIVER) return res.status(403).json({ error: "Parents cannot update route status." });
    const status = trim(body.status, 40);
    if (!["Scheduled", "On the way", "At stop", "Completed", "Delayed"].includes(status)) return res.status(422).json({ error: "Choose a valid route status." });
    const updated = await prisma.$transaction(async (tx) => {
      const route = await tx.route.update({ where: { id: access.route.id }, data: { status }, include: routeInclude });
      if (status === "Delayed") {
        const reason = trim(body.reason, 160) || "Delay reported by driver";
        const delayMinutes = Number(body.delayMinutes);
        const estimate = Number.isInteger(delayMinutes) && delayMinutes > 0 ? ` Estimated delay: ${delayMinutes} minutes.` : "";
        const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const title = `${route.number} delay reported`;
        const audience = `Route ${route.number} Families & Dispatch`;
        await tx.notification.create({ data: { id: makeId("NOTIF"), title, message: `${reason}.${estimate}`, category: "delay", routeId: route.id, audience, time, tone: "amber" } });
        await tx.activity.create({ data: { id: makeId("ACT"), icon: "!", title, detail: `${route.campus} · ${reason}`, time, tone: "amber", routeId: route.id, createdAt: new Date() } });
      }
      return route;
    });
    return res.json({ success: true, route: asRoute(updated) });
  }
  return res.status(422).json({ error: "Unsupported route action." });
});

// Notifications are visible by audience and route; each non-admin has individual read state.
app.get("/api/notifications", ...auth, async (req: Request, res) => {
  const routes = await visibleRouteIds(requestUser(req));
  const notifications = await visibleNotifications(requestUser(req), routes);
  res.json({ notifications, unreadCount: notifications.filter((notification) => !notification.read).length, total: notifications.length });
});
app.post("/api/notifications", ...auth, async (req: Request, res) => {
  const body = req.body || {};
  if (body.action === "mark_read") {
    const routes = await visibleRouteIds(requestUser(req));
    const id = trim(body.id, 120);
    const notification = id ? await prisma.notification.findUnique({ where: { id }, select: { id: true, routeId: true, audience: true } }) : null;
    if (id && !notification) return res.status(404).json({ error: "Notification not found." });
    if (notification && requestUser(req).role !== UserRole.SCHOOL_ADMIN) {
      const allowed = notification.routeId ? Boolean(routes?.includes(notification.routeId)) : requestUser(req).role === UserRole.PARENT ? /famil/i.test(notification.audience) : /driver/i.test(notification.audience);
      if (!allowed) return res.status(403).json({ error: "You cannot update this notification." });
    }
    if (requestUser(req).role === UserRole.SCHOOL_ADMIN) await prisma.notification.updateMany({ where: id ? { id } : {}, data: { read: true } });
    else if (id) await prisma.notificationRead.upsert({ where: { userId_notificationId: { userId: requestUser(req).id, notificationId: id } }, update: { readAt: new Date() }, create: { userId: requestUser(req).id, notificationId: id } });
    else {
      const visible = await visibleNotifications(requestUser(req), routes);
      await prisma.notificationRead.createMany({ data: visible.filter((item) => !item.read).map((item) => ({ userId: requestUser(req).id, notificationId: item.id })), skipDuplicates: true });
    }
    return res.json({ success: true });
  }
  if (body.action === "notify_driver") {
    if (requestUser(req).role !== UserRole.PARENT) return res.status(403).json({ error: "Only a parent can send a pickup message to a driver." });
    const student = await prisma.student.findFirst({ where: { id: trim(body.studentId, 100), parentUserId: requestUser(req).id } });
    if (!student) return res.status(404).json({ error: "Student not found in your account." });
    const route = await prisma.route.findUnique({ where: { id: student.routeId }, select: { id: true, number: true } });
    if (!route) return res.status(404).json({ error: "The student's route is not available." });
    const message = trim(body.message, 500) || `${student.guardian && object(student.guardian).name ? trim(object(student.guardian).name, 120) : "A parent"} is waiting at the pickup point for ${student.name}.`;
    const title = `Pickup message for ${student.name}`;
    const audience = "Drivers Only";
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const [notification] = await prisma.$transaction([
      prisma.notification.create({ data: { id: makeId("NOTIF"), title, message, category: "announcement", routeId: route.id, audience, time, tone: "blue" } }),
      prisma.activity.create({ data: { id: makeId("ACT"), icon: "↗", title, detail: route.number, time, tone: "blue", routeId: route.id, createdAt: new Date() } }),
    ]);
    return res.status(201).json({ success: true, notification });
  }
  if (requestUser(req).role !== UserRole.SCHOOL_ADMIN) return res.status(403).json({ error: "Only the School Admin can broadcast notifications." });
  const title = trim(body.title, 140); const message = trim(body.message, 2000); const routeId = trim(body.routeId, 100) || null;
  if (!title || !message) return res.status(422).json({ error: "Title and message are required." });
  if (routeId && !await prisma.route.findUnique({ where: { id: routeId }, select: { id: true } })) return res.status(422).json({ error: "Select an existing route." });
  const category = trim(body.category, 30) || "announcement"; const tone = trim(body.tone, 20) || "blue";
  if (!["delay", "pickup", "announcement", "emergency"].includes(category) || !["green", "blue", "amber", "rose"].includes(tone)) return res.status(422).json({ error: "Choose a valid notification category and tone." });
  const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const audience = trim(body.audience, 120) || "All Families & Staff";
  const [notification] = await prisma.$transaction([
    prisma.notification.create({ data: { id: makeId("NOTIF"), title, message, category, routeId, audience, time, tone } }),
    prisma.activity.create({ data: { id: makeId("ACT"), icon: "↗", title, detail: `${audience} · Broadcast`, time, tone, routeId, createdAt: new Date() } }),
  ]);
  return res.status(201).json({ success: true, notification });
});

app.delete("/api/notifications/:id", ...adminOnly, async (req, res) => {
  const id = trim(req.params.id, 120);
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return res.status(404).json({ error: "Notification not found." });
  const broadcastActivity = await prisma.activity.findFirst({
    where: {
      title: notification.title,
      detail: `${notification.audience} · Broadcast`,
      time: notification.time,
      routeId: notification.routeId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.notification.delete({ where: { id } });
    if (broadcastActivity) await tx.activity.delete({ where: { id: broadcastActivity.id } });
  });
  return res.json({ success: true });
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  const code = err instanceof Prisma.PrismaClientKnownRequestError ? err.code : "";
  if (code === "P2025") return res.status(404).json({ error: "The requested record was not found." });
  if (code === "P2002") return res.status(409).json({ error: "A record with these details already exists." });
  console.error("API request failed.");
  return res.status(500).json({ error: "API request failed." });
});
