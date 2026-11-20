import "dotenv/config";
import { app } from "./app";
import { prisma } from "../lib/prisma";

const port = Number(process.env.API_PORT || 4001);

prisma.$connect()
  .then(() => app.listen(port, () => console.log(`Waypoint API connected to PostgreSQL and listening on ${port}`)))
  .catch(() => {
    console.error("Waypoint API could not connect to PostgreSQL. Check DATABASE_URL in backend/.env.");
    process.exit(1);
  });