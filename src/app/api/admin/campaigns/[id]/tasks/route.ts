import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { defaultXFollowConfig, defaultTemplateForTask } from "@/lib/task-config";
import { discordGuildId } from "@/lib/discord";

export const dynamic = "force-dynamic";

const TYPES = ["X_FOLLOW", "X_POST", "DISCORD_JOIN", "DISCORD_ROLE", "EMAIL_VERIFY"];

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await awaitDb();
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    title?: string;
    description?: string;
    points?: number;
    handle?: string;
    mention?: string;
    guildId?: string;
    roleId?: string;
    primusTemplateId?: string;
  };

  const type = TYPES.includes(body.type || "") ? body.type! : "X_FOLLOW";
  const handle = (body.handle || "").replace(/^@/, "").trim();
  if (type === "X_FOLLOW" && !handle) {
    return NextResponse.json({ error: "X handle is required for a follow quest" }, { status: 400 });
  }
  const title =
    (body.title || "").trim() ||
    (type === "X_FOLLOW"
      ? `Follow @${handle}`
      : type === "X_POST"
        ? "Post on X"
        : type === "DISCORD_JOIN"
          ? "Join Discord"
          : type === "DISCORD_ROLE"
            ? "Get Discord role"
            : "Verify email");

  let config: Record<string, unknown> = {};
  if (type === "X_FOLLOW") {
    config = defaultXFollowConfig(handle);
  } else if (type === "X_POST") {
    config = { mention: (body.mention || "primus_labs").replace(/^@/, "") };
  } else if (type === "DISCORD_JOIN" || type === "DISCORD_ROLE") {
    const guildId = discordGuildId(body.guildId);
    if (!guildId) {
      return NextResponse.json({ error: "Discord server ID is required" }, { status: 400 });
    }
    config = { guildId, roleId: (body.roleId || "").trim() };
  }

  const last = await prisma.task.findFirst({
    where: { campaignId: campaign.id },
    orderBy: { sortOrder: "desc" },
  });

  const task = await prisma.task.create({
    data: {
      campaignId: campaign.id,
      type,
      title,
      description: (body.description || "").trim() || title,
      points: Math.max(1, Number(body.points) || 50),
      primusTemplateId: defaultTemplateForTask(type, body.primusTemplateId),
      config: JSON.stringify(config),
      sortOrder: (last?.sortOrder || 0) + 1,
    },
  });
  return NextResponse.json({ task });
}
