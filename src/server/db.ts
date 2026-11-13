import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      `DATABASE_URL must be a postgresql:// connection string (got "${url.split(":")[0]}:…"). ` +
        "The app moved from SQLite to Postgres — see .env.example.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// After `prisma generate` the PrismaClient class changes; drop a client cached from the old one.
export const db = globalForPrisma.prisma instanceof PrismaClient ? globalForPrisma.prisma : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
