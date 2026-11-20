import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

// Never replace values already supplied by the hosting environment.
dotenv.config({ path: ".env" });

const prisma = new PrismaClient();

async function findOrCreateAccount(emailValue: string | undefined, password: string | undefined, name: string, role: UserRole) {
  const email = emailValue?.trim().toLowerCase();
  if (!email || !password) return null;

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) {
    if (existing.role !== role) throw new Error(`The configured ${role} email is already used by another account type.`);
    return existing;
  }

  return prisma.user.create({
    data: { email, name, role, passwordHash: await bcrypt.hash(password, 12) },
  });
}

async function main() {
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let admin = configuredAdminEmail
    ? await prisma.user.findFirst({ where: { email: { equals: configuredAdminEmail, mode: "insensitive" } } })
    : null;
  if (admin && admin.role !== UserRole.SCHOOL_ADMIN) {
    throw new Error("ADMIN_EMAIL belongs to a non-admin account; refusing to change its role.");
  }

  if (!admin) {
    admin = await prisma.user.findFirst({ where: { role: UserRole.SCHOOL_ADMIN }, orderBy: { createdAt: "asc" } });
  }
  if (!admin) {
    admin = await findOrCreateAccount(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, "School Administrator", UserRole.SCHOOL_ADMIN);
  }
  if (admin) {
    await prisma.schoolAdminConfig.upsert({
      where: { id: "school" },
      update: {},
      create: { id: "school", userId: admin.id },
    });
    const canonical = await prisma.schoolAdminConfig.findUnique({ where: { id: "school" }, select: { userId: true } });
    if (canonical) await prisma.user.updateMany({ where: { role: UserRole.SCHOOL_ADMIN, id: { not: canonical.userId } }, data: { isActive: false } });
  }

  const seededDriver = await findOrCreateAccount(process.env.DRIVER_EMAIL, process.env.DRIVER_PASSWORD, "Bus Driver", UserRole.DRIVER);

  if (await prisma.route.count() === 0) {
    const legacyDriver = { name: "Amit Singh", phone: "+91 98765 01008", avatar: "AS", verified: true };
    const vehicleData = { reg: "KA 05 MN 2048", model: "School bus", capacity: 32, inspectionStatus: "Passed" };
    const vehicle = await prisma.vehicle.upsert({
      where: { registration: vehicleData.reg },
      update: {},
      create: { registration: vehicleData.reg, model: vehicleData.model, capacity: vehicleData.capacity, inspectionStatus: vehicleData.inspectionStatus },
    });
    await prisma.route.create({
      data: {
        id: "RTE-008", number: "Route 08", campus: "North Campus", status: "On the way",
        driver: legacyDriver, vehicle: vehicleData, eta: "8:10 AM", currentStopIndex: 0,
        ...(seededDriver ? { driverId: seededDriver.id } : {}),
        stops: [
          { id: "ST-08-1", name: "Lakeview Apartments", area: "North Gate", time: "7:32 AM", status: "current", student: "Aarav Mehta" },
          { id: "ST-08-2", name: "Pinecrest School", area: "Main entrance", time: "8:10 AM", status: "upcoming" },
        ],
        vehicleId: vehicle.id,
        routeStops: {
          create: [
            { legacyId: "ST-08-1", name: "Lakeview Apartments", area: "North Gate", time: "7:32 AM", status: "current", studentName: "Aarav Mehta", position: 0 },
            { legacyId: "ST-08-2", name: "Pinecrest School", area: "Main entrance", time: "8:10 AM", status: "upcoming", position: 1 },
          ],
        },
      },
    });
  }
}

main()
  .catch((error) => { console.error("Database seed failed.", error instanceof Error ? error.message : "Unknown error"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
