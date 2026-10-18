import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

let schemaReady: Promise<void> | null = null;

export function awaitDb() {
  if (!schemaReady) schemaReady = ensureSchema();
  return schemaReady;
}

async function ensureSchema() {
  try {
    await prisma.user.findFirst({ select: { id: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unreachable";
    throw new Error(
      `Postgres is not ready (${message}). Set DATABASE_URL to the Neon pooled URL and run npx prisma db push.`
    );
  }
}
