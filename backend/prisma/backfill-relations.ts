import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const stringValue = (value: unknown, fallback = ""): string => typeof value === "string" ? value.trim() : fallback;
const numberValue = (value: unknown, fallback: number): number => Number.isFinite(Number(value)) ? Number(value) : fallback;

async function main() {
  const collisions = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM (
      SELECT LOWER("email") FROM "User" GROUP BY LOWER("email") HAVING COUNT(*) > 1
    ) AS duplicate_emails
  `;
  if (collisions[0]?.count) throw new Error("Case-insensitive duplicate email addresses exist; review those accounts before enforcing email uniqueness.");
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_unique_idx" ON "User" (LOWER("email"))`;

  const currentAdminConfig = await prisma.schoolAdminConfig.findUnique({ where: { id: "school" } });
  if (!currentAdminConfig) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const admin = adminEmail
      ? await prisma.user.findFirst({ where: { email: { equals: adminEmail, mode: "insensitive" }, role: UserRole.SCHOOL_ADMIN, isActive: true } })
      : await prisma.user.findFirst({ where: { role: UserRole.SCHOOL_ADMIN, isActive: true }, orderBy: { createdAt: "asc" } });
    if (admin) await prisma.schoolAdminConfig.create({ data: { id: "school", userId: admin.id } });
  }
  const canonicalAdmin = await prisma.schoolAdminConfig.findUnique({ where: { id: "school" }, select: { userId: true } });
  if (canonicalAdmin) {
    await prisma.user.updateMany({ where: { role: UserRole.SCHOOL_ADMIN, id: { not: canonicalAdmin.userId } }, data: { isActive: false } });
  }
  const routes = await prisma.route.findMany({ include: { routeStops: { select: { legacyId: true } } } });
  let linkedDrivers = 0;
  let linkedVehicles = 0;
  let createdStops = 0;

  for (const route of routes) {
    const legacyDriver = record(route.driver);
    if (!route.driverId) {
      const email = stringValue(legacyDriver.email).toLowerCase();
      const name = stringValue(legacyDriver.name);
      const emailMatch = email ? await prisma.user.findFirst({ where: { email, role: UserRole.DRIVER, isActive: true } }) : null;
      const matches = email
        ? emailMatch ? [emailMatch] : []
        : name
          ? await prisma.user.findMany({ where: { name: { equals: name, mode: "insensitive" }, role: UserRole.DRIVER, isActive: true }, take: 2 })
          : [];
      if (matches.length === 1 && matches[0]) {
        await prisma.route.update({ where: { id: route.id }, data: { driverId: matches[0].id } });
        linkedDrivers += 1;
      }
    }

    const legacyVehicle = record(route.vehicle);
    const registration = stringValue(legacyVehicle.registration, stringValue(legacyVehicle.reg));
    if (!route.vehicleId && registration) {
      const vehicle = await prisma.vehicle.upsert({
        where: { registration },
        update: {
          model: stringValue(legacyVehicle.model, "School bus"),
          capacity: numberValue(legacyVehicle.capacity, 32),
          inspectionStatus: stringValue(legacyVehicle.inspectionStatus, "Pending"),
        },
        create: {
          registration,
          model: stringValue(legacyVehicle.model, "School bus"),
          capacity: numberValue(legacyVehicle.capacity, 32),
          inspectionStatus: stringValue(legacyVehicle.inspectionStatus, "Pending"),
        },
      });
      await prisma.route.update({ where: { id: route.id }, data: { vehicleId: vehicle.id } });
      linkedVehicles += 1;
    }

    const legacyStops = Array.isArray(route.stops) ? route.stops : [];
    const existingIds = new Set(route.routeStops.map((stop) => stop.legacyId).filter((id): id is string => Boolean(id)));
    const newStops = legacyStops.flatMap((value, position) => {
      const stop = record(value);
      const legacyId = stringValue(stop.id);
      const name = stringValue(stop.name);
      if (!legacyId || !name || existingIds.has(legacyId)) return [];
      return [{
        routeId: route.id,
        legacyId,
        name,
        area: stringValue(stop.area),
        time: stringValue(stop.time),
        status: stringValue(stop.status, "upcoming"),
        studentName: stringValue(stop.student) || null,
        position,
      }];
    });
    if (newStops.length) {
      const result = await prisma.routeStop.createMany({ data: newStops, skipDuplicates: true });
      createdStops += result.count;
    }
  }

  console.log(`Relational backfill complete: ${linkedDrivers} drivers linked, ${linkedVehicles} vehicles linked, ${createdStops} stops added.`);
}

main()
  .catch((error) => { console.error("Relational backfill failed.", error instanceof Error ? error.message : "Unknown error"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
