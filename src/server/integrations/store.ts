import "server-only";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { db } from "@/server/db";

export type IntegrationProvider = "github" | "vercel";
export type IntegrationStatus = { connected: boolean; accountName?: string };

export async function saveIntegration(userId: string, provider: IntegrationProvider, token: string, accountName: string) {
  const tokenEncrypted = encryptSecret(token);
  await db.integration.upsert({
    where: { userId_provider: { userId, provider } },
    update: { tokenEncrypted, accountName },
    create: { userId, provider, tokenEncrypted, accountName },
  });
}

export async function removeIntegration(userId: string, provider: IntegrationProvider) {
  await db.integration.deleteMany({ where: { userId, provider } });
}

/** The decrypted token, or null when not connected (or no longer decryptable). */
export async function getIntegrationToken(userId: string, provider: IntegrationProvider) {
  const row = await db.integration.findUnique({ where: { userId_provider: { userId, provider } } });
  if (!row) return null;
  try {
    return { token: decryptSecret(row.tokenEncrypted), accountName: row.accountName };
  } catch {
    return null; // AUTH_SECRET changed: the user must reconnect
  }
}

export async function getIntegrationStatuses(userId: string): Promise<Record<IntegrationProvider, IntegrationStatus>> {
  const rows = await db.integration.findMany({ where: { userId }, select: { provider: true, accountName: true } });
  const find = (p: IntegrationProvider) => rows.find((r) => r.provider === p);
  return {
    github: { connected: !!find("github"), accountName: find("github")?.accountName },
    vercel: { connected: !!find("vercel"), accountName: find("vercel")?.accountName },
  };
}
