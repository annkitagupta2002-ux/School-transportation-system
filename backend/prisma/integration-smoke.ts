import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

dotenv.config({ path: ".env" });

// The smoke test intentionally asserts ad hoc response shapes from multiple APIs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResult = { status: number; data: Record<string, any>; cookie?: string };
const runId = randomUUID();
const email = (label: string) => `waypoint-${label}-${runId}@example.invalid`;
const password = `Wp-${runId}-Pass!`;
const driverIds: string[] = [];
const userIds: string[] = [];
const routeIds: string[] = [];
const vehicleRegistrations: string[] = [];
const notificationIds: string[] = [];
const activityIds: string[] = [];
let activeStage = "initial setup";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, "The configured admin credentials are unavailable for integration checks.");
  assert(process.env.JWT_SECRET, "The configured API signing secret is unavailable for integration checks.");

  const [{ app }, { prisma }, { UserRole }] = await Promise.all([
    import("../server/app"),
    import("../lib/prisma"),
    import("@prisma/client"),
  ]);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;

  async function call(path: string, options: { method?: string; body?: unknown; cookie?: string } = {}): Promise<ApiResult> {
    const headers = new Headers();
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (options.cookie) headers.set("Cookie", options.cookie);
    const response = await fetch(`${origin}${path}`, { method: options.method || "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { data = await response.json() as Record<string, any>; } catch { /* Keep an empty response body for status assertions. */ }
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    return { status: response.status, data, cookie };
  }

  async function expect(result: ApiResult, status: number, message: string) {
    assert(result.status === status, `${message}: expected HTTP ${status}, received ${result.status}.`);
  }

  let adminCookie = "";
  let parentCookie = "";
  let driverOneCookie = "";
  let driverTwoCookie = "";
  let adminStudentId = "";
  let parentStudentId = "";
  let routeOneId = "";
  let routeTwoId = "";
  let driverOneId = "";
  let driverTwoId = "";
  let parentId = "";
  let standaloneVehicleId = "";
  let stopIds: string[] = [];
  let temporaryAdminId = "";
  let passed = 0;

  try {
    activeStage = "existing School Admin login";
    const adminLogin = await call("/api/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
    await expect(adminLogin, 200, activeStage);
    adminCookie = adminLogin.cookie || "";
    assert(adminCookie.startsWith("waypoint_session="), "Admin login did not issue an httpOnly session cookie.");
    assert(!JSON.stringify(adminLogin.data).toLowerCase().includes("passwordhash"), "Admin login exposed a password hash.");
    passed += 1;

    activeStage = "only the configured admin can authenticate as School Admin";
    const secondAdminPasswordHash = await bcrypt.hash(password, 12);
    const secondAdmin = await prisma.user.create({ data: { email: email("admin"), name: "Temporary Integration Admin", passwordHash: secondAdminPasswordHash, role: UserRole.SCHOOL_ADMIN } });
    temporaryAdminId = secondAdmin.id;
    const deniedAdminLogin = await call("/api/auth/login", { method: "POST", body: { email: secondAdmin.email, password } });
    await expect(deniedAdminLogin, 403, activeStage);
    passed += 1;

    activeStage = "create multiple independent driver accounts";
    const createdDriverOne = await call("/api/drivers", { method: "POST", cookie: adminCookie, body: { name: "Integration Driver One", email: email("driver-one"), password } });
    await expect(createdDriverOne, 201, activeStage);
    driverOneId = createdDriverOne.data.driver.id; driverIds.push(driverOneId);
    const createdDriverTwo = await call("/api/drivers", { method: "POST", cookie: adminCookie, body: { name: "Integration Driver Two", email: email("driver-two"), password } });
    await expect(createdDriverTwo, 201, activeStage);
    driverTwoId = createdDriverTwo.data.driver.id; driverIds.push(driverTwoId);
    const driverList = await call("/api/drivers", { cookie: adminCookie });
    await expect(driverList, 200, activeStage);
    assert(driverList.data.drivers.some((driver: { id: string }) => driver.id === driverOneId) && driverList.data.drivers.some((driver: { id: string }) => driver.id === driverTwoId), "Admin driver list did not return both new accounts.");
    assert(!JSON.stringify(driverList.data).toLowerCase().includes("passwordhash"), "Driver list exposed a password hash.");
    passed += 1;

    activeStage = "create routes with normalized driver and vehicle assignments";
    const createdRouteOne = await call("/api/routes", { method: "POST", cookie: adminCookie, body: { number: `Route One ${runId.slice(0, 6)}`, campus: "Integration Campus", driverId: driverOneId, vehicleReg: `IT-${runId.slice(0, 8)}-1`, vehicleModel: "Integration Bus A", capacity: 20 } });
    await expect(createdRouteOne, 201, activeStage);
    routeOneId = createdRouteOne.data.route.id; routeIds.push(routeOneId);
    const createdRouteTwo = await call("/api/routes", { method: "POST", cookie: adminCookie, body: { number: `Route Two ${runId.slice(0, 6)}`, campus: "Integration Campus", driverId: driverTwoId, vehicleReg: `IT-${runId.slice(0, 8)}-2`, vehicleModel: "Integration Bus B", capacity: 24 } });
    await expect(createdRouteTwo, 201, activeStage);
    routeTwoId = createdRouteTwo.data.route.id; routeIds.push(routeTwoId);
    vehicleRegistrations.push(createdRouteOne.data.route.vehicle.reg, createdRouteTwo.data.route.vehicle.reg);
    const relationalRoute = await prisma.route.findUnique({ where: { id: routeOneId }, include: { assignedDriver: true, assignedVehicle: true, routeStops: true } });
    assert(relationalRoute?.assignedDriver?.id === driverOneId && relationalRoute.assignedVehicle?.registration === createdRouteOne.data.route.vehicle.reg, "Route assignments were not persisted as relations.");
    const storedVehicles = await call("/api/vehicles", { cookie: adminCookie });
    await expect(storedVehicles, 200, activeStage);
    assert(storedVehicles.data.vehicles.some((vehicle: { registration: string }) => vehicle.registration === createdRouteOne.data.route.vehicle.reg), "Assigned vehicle was not returned from PostgreSQL.");
    passed += 1;

    activeStage = "edit driver profile and route assignment";
    const newDriverEmail = email("driver-one-edited");
    const editedDriver = await call(`/api/drivers/${driverOneId}`, { method: "PATCH", cookie: adminCookie, body: { name: "Integration Driver One Edited", email: newDriverEmail, password: `${password}x`, routeId: routeOneId, isActive: true } });
    await expect(editedDriver, 200, activeStage);
    assert(editedDriver.data.driver.email === newDriverEmail, "Driver profile changes were not returned.");
    passed += 1;

    activeStage = "both drivers log in independently with hashed passwords";
    const driverOneLogin = await call("/api/auth/login", { method: "POST", body: { email: newDriverEmail, password: `${password}x`, expectedRole: UserRole.DRIVER } });
    await expect(driverOneLogin, 200, activeStage); driverOneCookie = driverOneLogin.cookie || "";
    const driverTwoLogin = await call("/api/auth/login", { method: "POST", body: { email: email("driver-two"), password, expectedRole: UserRole.DRIVER } });
    await expect(driverTwoLogin, 200, activeStage); driverTwoCookie = driverTwoLogin.cookie || "";
    const driverOneRoutes = await call("/api/routes", { cookie: driverOneCookie });
    const driverTwoRoutes = await call("/api/routes", { cookie: driverTwoCookie });
    assert(driverOneRoutes.data.routes.length === 1 && driverOneRoutes.data.routes[0].id === routeOneId, "Driver one can see another driver's routes.");
    assert(driverTwoRoutes.data.routes.length === 1 && driverTwoRoutes.data.routes[0].id === routeTwoId, "Driver two can see another driver's routes.");
    passed += 1;

    activeStage = "stop create, read, update, and delete";
    const firstStop = await call("/api/routes", { method: "POST", cookie: adminCookie, body: { action: "add_stop", routeId: routeOneId, name: "Integration Stop A", area: "North gate", time: "7:30 AM" } });
    await expect(firstStop, 201, activeStage);
    const secondStop = await call("/api/routes", { method: "POST", cookie: adminCookie, body: { action: "add_stop", routeId: routeOneId, name: "Integration Stop B", area: "Main gate", time: "7:40 AM" } });
    await expect(secondStop, 201, activeStage);
    stopIds = [firstStop.data.stop.id, secondStop.data.stop.id];
    const editedStop = await call(`/api/stops/${stopIds[0]}`, { method: "PATCH", cookie: adminCookie, body: { routeId: routeOneId, name: "Integration Stop A Updated", area: "North gate updated", time: "7:31 AM" } });
    await expect(editedStop, 200, activeStage);
    assert(editedStop.data.route.stops.some((stop: { name: string }) => stop.name === "Integration Stop A Updated"), "Updated stop was not returned from the database.");
    passed += 1;

    activeStage = "parent registration, duplicate prevention, login, and profile";
    const parentEmail = email("parent");
    const registration = await call("/api/auth/register-parent", { method: "POST", body: { name: "Integration Parent", email: parentEmail, password } });
    await expect(registration, 201, activeStage); parentCookie = registration.cookie || ""; parentId = registration.data.user.id; userIds.push(parentId);
    const duplicateRegistration = await call("/api/auth/register-parent", { method: "POST", body: { name: "Integration Parent Duplicate", email: parentEmail.toUpperCase(), password } });
    await expect(duplicateRegistration, 409, activeStage);
    const parentLogin = await call("/api/auth/login", { method: "POST", body: { email: parentEmail, password, expectedRole: UserRole.PARENT } });
    await expect(parentLogin, 200, activeStage); parentCookie = parentLogin.cookie || parentCookie;
    const updatedProfile = await call("/api/auth/me", { method: "PATCH", cookie: parentCookie, body: { name: "Integration Parent Updated", email: email("parent-edited") } });
    await expect(updatedProfile, 200, activeStage);
    assert(!JSON.stringify(updatedProfile.data).toLowerCase().includes("passwordhash"), "Parent profile exposed a password hash.");
    parentCookie = (await call("/api/auth/login", { method: "POST", body: { email: email("parent-edited"), password, expectedRole: UserRole.PARENT } })).cookie || parentCookie;
    passed += 1;

    activeStage = "student create, scoped retrieval, edit, status, and safe delete";
    const parentStudent = await call("/api/students", { method: "POST", cookie: parentCookie, body: { name: "Integration Child", grade: "Grade 4", routeId: routeOneId, stopName: "Integration Stop A", guardianName: "Integration Parent Updated", guardianPhone: "0000000000", guardianRelation: "Parent" } });
    await expect(parentStudent, 201, activeStage); parentStudentId = parentStudent.data.student.id;
    const adminStudent = await call("/api/students", { method: "POST", cookie: adminCookie, body: { name: "Integration Admin Student", grade: "Grade 5", routeId: routeOneId, stopName: "Integration Stop B", guardianName: "School Admin", guardianPhone: "0000000001" } });
    await expect(adminStudent, 201, activeStage); adminStudentId = adminStudent.data.student.id;
    const pickupMessage = await call("/api/notifications", { method: "POST", cookie: parentCookie, body: { action: "notify_driver", studentId: parentStudentId } });
    await expect(pickupMessage, 201, activeStage); notificationIds.push(pickupMessage.data.notification.id);
    const parentStudents = await call("/api/students", { cookie: parentCookie });
    assert(parentStudents.status === 200 && parentStudents.data.students.length === 1 && parentStudents.data.students[0].id === parentStudentId, "Parent student records are not properly scoped.");
    const deniedParentEdit = await call(`/api/students/${adminStudentId}`, { method: "PATCH", cookie: parentCookie, body: { name: "Unauthorized" } });
    await expect(deniedParentEdit, 403, activeStage);
    const editedStudent = await call(`/api/students/${adminStudentId}`, { method: "PATCH", cookie: adminCookie, body: { name: "Integration Admin Student Edited", grade: "Grade 5-B", routeId: routeOneId, stopName: "Integration Stop B", guardianName: "School Admin", guardianPhone: "0000000001" } });
    await expect(editedStudent, 200, activeStage);
    const parentAbsent = await call("/api/students", { method: "POST", cookie: parentCookie, body: { studentId: parentStudentId, status: "Absent" } });
    await expect(parentAbsent, 200, activeStage);
    const driverPickup = await call(`/api/students/${parentStudentId}`, { method: "PATCH", cookie: driverOneCookie, body: { status: "Picked up" } });
    await expect(driverPickup, 200, activeStage);
    const persistedStudent = await prisma.student.findUnique({ where: { id: parentStudentId } });
    assert(persistedStudent?.status === "Picked up", "Driver status did not persist in PostgreSQL.");
    passed += 1;

    activeStage = "route advancement, status, and route CRUD";
    const advanced = await call("/api/route", { method: "POST", cookie: driverOneCookie, body: { routeId: routeOneId, action: "advance_stop" } });
    await expect(advanced, 200, activeStage);
    const delayed = await call("/api/route", { method: "POST", cookie: driverOneCookie, body: { routeId: routeOneId, status: "Delayed", reason: "Integration test traffic", delayMinutes: "5" } });
    await expect(delayed, 200, activeStage);
    const editedRoute = await call(`/api/routes/${routeTwoId}`, { method: "PATCH", cookie: adminCookie, body: { number: `Edited route ${runId.slice(0, 6)}`, campus: "Updated Integration Campus", driverId: driverTwoId, vehicleReg: `IT-${runId.slice(0, 8)}-2`, vehicleModel: "Updated Bus B", capacity: 28 } });
    await expect(editedRoute, 200, activeStage);
    assert(editedRoute.data.route.vehicle.model === "Updated Bus B", "Route vehicle changes did not return the updated linked vehicle.");
    const blockedRouteDelete = await call(`/api/routes/${routeOneId}`, { method: "DELETE", cookie: adminCookie });
    await expect(blockedRouteDelete, 409, activeStage);
    passed += 1;

    activeStage = "notifications save, retrieve, and per-parent read state";
    const broadcast = await call("/api/notifications", { method: "POST", cookie: adminCookie, body: { title: "Integration Notice", message: "Database persistence check", category: "announcement", audience: "All Families & Staff", tone: "blue" } });
    await expect(broadcast, 201, activeStage); notificationIds.push(broadcast.data.notification.id);
    const broadcastActivities = await prisma.activity.findMany({ where: { title: "Integration Notice", detail: "All Families & Staff · Broadcast" }, select: { id: true } });
    activityIds.push(...broadcastActivities.map((item) => item.id));
    const broadcastActivity = await prisma.activity.findFirst({ where: { title: "Integration Notice", detail: "All Families & Staff · Broadcast", routeId: null }, orderBy: { createdAt: "desc" } });
    const routeNotifications = await prisma.notification.findMany({ where: { routeId: routeOneId }, select: { id: true } });
    notificationIds.push(...routeNotifications.map((item) => item.id));
    const routeActivities = await prisma.activity.findMany({ where: { routeId: routeOneId }, select: { id: true } });
    activityIds.push(...routeActivities.map((item) => item.id));
    const parentNotifications = await call("/api/notifications", { cookie: parentCookie });
    assert(parentNotifications.status === 200 && parentNotifications.data.notifications.some((item: { id: string }) => item.id === broadcast.data.notification.id) && parentNotifications.data.notifications.some((item: { routeId: string }) => item.routeId === routeOneId), "Parent did not receive persisted general and route notifications.");
    const markedRead = await call("/api/notifications", { method: "POST", cookie: parentCookie, body: { action: "mark_read", id: broadcast.data.notification.id } });
    await expect(markedRead, 200, activeStage);
    const parentRead = await prisma.notificationRead.findUnique({ where: { userId_notificationId: { userId: parentId, notificationId: broadcast.data.notification.id } } });
    assert(Boolean(parentRead), "Parent read receipt was not stored independently.");
    const driverNotifications = await call("/api/notifications", { cookie: driverOneCookie });
    assert(driverNotifications.data.notifications.some((item: { routeId: string }) => item.routeId === routeOneId), "Driver did not receive route notifications.");
    passed += 1;

    activeStage = "admin can delete a broadcast and its activity record";
    await expect(await call(`/api/notifications/${broadcast.data.notification.id}`, { method: "DELETE", cookie: parentCookie }), 403, activeStage);
    await expect(await call(`/api/notifications/${broadcast.data.notification.id}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    assert(await prisma.notification.findUnique({ where: { id: broadcast.data.notification.id } }) === null, "Deleted broadcast remained in PostgreSQL.");
    if (broadcastActivity) assert(await prisma.activity.findUnique({ where: { id: broadcastActivity.id } }) === null, "Deleted broadcast activity remained in PostgreSQL.");
    passed += 1;

    activeStage = "standalone vehicle create, update, and delete";
    const vehicleRegistration = `IT-${runId.slice(0, 8)}-3`;
    vehicleRegistrations.push(vehicleRegistration);
    const createdVehicle = await call("/api/vehicles", { method: "POST", cookie: adminCookie, body: { registration: vehicleRegistration, model: "Integration Spare", capacity: 12 } });
    await expect(createdVehicle, 201, activeStage); standaloneVehicleId = createdVehicle.data.vehicle.id;
    const updatedVehicle = await call(`/api/vehicles/${standaloneVehicleId}`, { method: "PATCH", cookie: adminCookie, body: { model: "Updated Integration Spare", capacity: 14 } });
    await expect(updatedVehicle, 200, activeStage);
    assert(updatedVehicle.data.vehicle.capacity === 14, "Vehicle update did not persist.");
    passed += 1;

    activeStage = "deactivate and reactivate a driver account";
    const deactivated = await call(`/api/drivers/${driverOneId}`, { method: "DELETE", cookie: adminCookie });
    await expect(deactivated, 200, activeStage);
    const blockedLogin = await call("/api/auth/login", { method: "POST", body: { email: newDriverEmail, password: `${password}x` } });
    await expect(blockedLogin, 401, activeStage);
    const reactivated = await call(`/api/drivers/${driverOneId}`, { method: "PATCH", cookie: adminCookie, body: { isActive: true } });
    await expect(reactivated, 200, activeStage);
    const reactivatedLogin = await call("/api/auth/login", { method: "POST", body: { email: newDriverEmail, password: `${password}x` } });
    await expect(reactivatedLogin, 200, activeStage); driverOneCookie = reactivatedLogin.cookie || driverOneCookie;
    passed += 1;

    activeStage = "unauthorized requests are rejected";
    await expect(await call("/api/routes"), 401, activeStage);
    await expect(await call("/api/drivers", { cookie: parentCookie }), 403, activeStage);
    await expect(await call(`/api/routes/${routeOneId}`, { method: "DELETE", cookie: driverOneCookie }), 403, activeStage);
    passed += 1;

    activeStage = "remove only temporary integration records";
    await expect(await call(`/api/students/${adminStudentId}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    await expect(await call(`/api/students/${parentStudentId}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    await expect(await call(`/api/stops/${stopIds[0]}?routeId=${routeOneId}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    await expect(await call(`/api/stops/${stopIds[1]}?routeId=${routeOneId}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    await expect(await call(`/api/routes/${routeOneId}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    await expect(await call(`/api/routes/${routeTwoId}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    await expect(await call(`/api/vehicles/${standaloneVehicleId}`, { method: "DELETE", cookie: adminCookie }), 200, activeStage);
    passed += 1;

    console.log(`Neon integration checks passed: ${passed} groups; driver accounts, parent auth/profile, CRUD, assignments, role scope, notifications, and persistence.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = message.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[database URL redacted]");
    console.error(`Neon integration check failed at: ${activeStage}. ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    const prismaModule = await import("../lib/prisma");
    const prisma = prismaModule.prisma;
    try {
      if (adminStudentId || parentStudentId) await prisma.student.deleteMany({ where: { id: { in: [adminStudentId, parentStudentId].filter(Boolean) } } });
      if (notificationIds.length) await prisma.notification.deleteMany({ where: { id: { in: [...new Set(notificationIds)] } } });
      if (activityIds.length) await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
      if (routeIds.length) {
        await prisma.notification.deleteMany({ where: { routeId: { in: routeIds } } });
        await prisma.activity.deleteMany({ where: { routeId: { in: routeIds } } });
        await prisma.route.deleteMany({ where: { id: { in: routeIds } } });
      }
      if (vehicleRegistrations.length) await prisma.vehicle.deleteMany({ where: { registration: { in: vehicleRegistrations } } });
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (driverIds.length) await prisma.user.deleteMany({ where: { id: { in: driverIds } } });
      if (temporaryAdminId) await prisma.user.deleteMany({ where: { id: temporaryAdminId } });
    } catch {
      console.error("Temporary integration cleanup encountered an error; inspect only records with the integration run identifier.");
      process.exitCode = 1;
    }
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

void main();
