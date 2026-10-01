import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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

  const campaigns = await prisma.campaign.count();
  if (campaigns > 0) return;

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
              inviteUrl: process.env.DISCORD_INVITE_URL || "",
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
