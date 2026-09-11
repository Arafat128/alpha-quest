import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function resolveSqliteUrl() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  if (!raw.startsWith("file:")) return raw;
  if (!process.env.VERCEL) return raw;

  const dest = "/tmp/alpha-quest.db";
  const rel = raw.replace(/^file:/, "");
  const candidates = [
    path.resolve(process.cwd(), rel),
    path.join(process.cwd(), "prisma", "data.db"),
    path.join(process.cwd(), "prisma", "dev.db"),
  ];
  if (!fs.existsSync(dest)) {
    const src = candidates.find((file) => fs.existsSync(file));
    if (src) fs.copyFileSync(src, dest);
  }
  return `file:${dest}`;
}

const databaseUrl = resolveSqliteUrl();
if (databaseUrl.startsWith("file:") && process.env.VERCEL) {
  process.env.DATABASE_URL = databaseUrl;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: databaseUrl } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let schemaReady: Promise<void> | null = null;

export function awaitDb() {
  if (!schemaReady) schemaReady = ensureSchema();
  return schemaReady;
}

async function ensureSchema() {
  try {
    await prisma.$queryRawUnsafe("SELECT id FROM User LIMIT 1");
    return;
  } catch {
    /* empty or missing tables */
  }

  const sqlPath = path.join(process.cwd(), "prisma", "init.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error("Database is not initialized (missing prisma/init.sql)");
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const campaigns = await prisma.campaign.count();
  if (campaigns === 0) {
    const { defaultXFollowConfig } = await import("./task-config");
    await prisma.campaign.create({
      data: {
        slug: "genesis-attestation",
        title: "Genesis Attestation",
        description:
          "Complete real social actions. Follows and posts are proven with zkTLS — not a checkbox.",
        accent: "#38bdf8",
        startsAt: new Date(),
        tasks: {
          create: [
            {
              type: "X_FOLLOW",
              title: "Follow @example_owner on X",
              description:
                "Follow @example_owner on X. We verify the follow from your live X session.",
              config: JSON.stringify(defaultXFollowConfig("example_owner")),
              points: 100,
              sortOrder: 1,
            },
            {
              type: "DISCORD_JOIN",
              title: "Join the campaign Discord",
              description:
                "Join the campaign Discord. Membership is checked against the official server.",
              config: JSON.stringify({
                guildId: process.env.DISCORD_GUILD_ID || "",
                requiredField: "id",
              }),
              points: 80,
              sortOrder: 3,
            },
            {
              type: "EMAIL_VERIFY",
              title: "Verify your email",
              description: "Confirm your email with a one-time code.",
              config: JSON.stringify({}),
              points: 40,
              sortOrder: 4,
            },
          ],
        },
      },
    });
  }
}
