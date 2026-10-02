import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseTaskConfig, defaultTemplateForTask } from "@/lib/task-config";
import { discordGuildId, discordInviteUrl } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await awaitDb();
  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }] },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { user } = await requireUser();
  const completions = user
    ? await prisma.taskCompletion.findMany({
        where: { userId: user.id, taskId: { in: campaign.tasks.map((t) => t.id) } },
      })
    : [];
  const done = new Set(completions.map((c) => c.taskId));

  const ended = Boolean(campaign.endsAt && campaign.endsAt.getTime() <= Date.now());

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      description: campaign.description,
      accent: campaign.accent,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      ended,
    },
    tasks: campaign.tasks.map((task) => {
      const config = parseTaskConfig(task.config);
      return {
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        points: task.points,
        primusTemplateId: defaultTemplateForTask(task.type, task.primusTemplateId),
        config: {
          handle: config.handle,
          mention: config.mention,
          guildId: discordGuildId(config.guildId) || config.guildId,
          inviteUrl: config.inviteUrl || discordInviteUrl() || undefined,
          roleId: config.roleId,
          requiredField: config.requiredField,
          request: config.request,
          responseResolves: config.responseResolves,
        },
        status: done.has(task.id) ? "verified" : ended ? "locked" : "not_started",
        ownerCompletes:
          task.type === "X_FOLLOW" &&
          Boolean(config.handle),
      };
    }),
  });
}
