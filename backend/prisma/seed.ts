import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

dotenv.config({ path: ".env", override: true });

const prisma = new PrismaClient();

async function seedUser(email: string | undefined, password: string | undefined, name: string, role: UserRole) {
  if (!email || !password) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({ where: { email: email.toLowerCase() }, update: { name, role, passwordHash }, create: { email: email.toLowerCase(), name, role, passwordHash } });
}

async function main() {
  await seedUser(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, "School Administrator", UserRole.SCHOOL_ADMIN);
  await seedUser(process.env.DRIVER_EMAIL, process.env.DRIVER_PASSWORD, "Bus Driver", UserRole.DRIVER);
  if (await prisma.route.count() === 0) {
    await prisma.route.create({ data: {
      id: "RTE-008", number: "Route 08", campus: "North Campus", status: "On the way",
      driver: { name: "Amit Singh", phone: "+91 98765 01008", avatar: "AS", verified: true },
      vehicle: { reg: "KA 05 MN 2048", model: "School bus", capacity: 32, inspectionStatus: "Passed" }, eta: "8:10 AM", currentStopIndex: 0,
      stops: [{ id: "ST-08-1", name: "Lakeview Apartments", area: "North Gate", time: "7:32 AM", status: "current", student: "Aarav Mehta" }, { id: "ST-08-2", name: "Pinecrest School", area: "Main entrance", time: "8:10 AM", status: "upcoming" }],
    } });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
