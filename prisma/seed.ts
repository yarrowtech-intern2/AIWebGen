// Development seed. Safe to run repeatedly.
// - Demo login: demo@example.com / demo12345 (development only)
// - Backfills a first version for projects created before version history existed.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a demo user in production.");

  const existing = await db.user.findUnique({ where: { email: "demo@example.com" } });
  const passwordHash = await bcrypt.hash("demo12345", 12);
  const user = existing
    ? existing.passwordHash.startsWith("$2")
      ? existing
      : await db.user.update({ where: { id: existing.id }, data: { passwordHash } })
    : await db.user.create({ data: { email: "demo@example.com", name: "Demo User", passwordHash } });
  console.log(`Demo user ready: ${user.email} / demo12345`);

  const unversioned = await db.project.findMany({ where: { versions: { none: {} } }, include: { files: true } });
  for (const project of unversioned) {
    const snapshot = JSON.stringify(Object.fromEntries(project.files.map((f) => [f.path, f.content])));
    const version = await db.version.create({
      data: { projectId: project.id, number: 1, source: "template", summary: "Initial snapshot", snapshot },
    });
    await db.project.update({ where: { id: project.id }, data: { currentVersionId: version.id } });
  }
  if (unversioned.length) console.log(`Backfilled v1 for ${unversioned.length} project(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
