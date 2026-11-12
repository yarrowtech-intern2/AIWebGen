import "server-only";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

const BCRYPT_COST = 12;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("not-a-real-password", BCRYPT_COST));

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class EmailTakenError extends Error {}

export async function registerUser(input: { email: string; password: string; name?: string }) {
  const email = normalizeEmail(input.email);
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new EmailTakenError();
  return db.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
    },
    select: { id: true },
  });
}

/** Returns the user id when the email and password match, otherwise null. */
export async function verifyCredentials(emailInput: string, password: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { email: normalizeEmail(emailInput) },
    select: { id: true, passwordHash: true },
  });
  const hash = user?.passwordHash.startsWith("$2") ? user.passwordHash : await getDummyHash();
  const ok = await bcrypt.compare(password, hash);
  return ok && user ? user.id : null;
}
