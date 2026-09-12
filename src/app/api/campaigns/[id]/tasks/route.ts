import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseTaskConfig } from "@/lib/task-config";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
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

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      description: campaign.description,
      accent: campaign.accent,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
    },
    tasks: campaign.tasks.map((task) => {
      const config = parseTaskConfig(task.config);
      return {
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        points: task.points,
        primusTemplateId:
          task.primusTemplateId ||
          (task.type === "X_FOLLOW" ? process.env.PRIMUS_TEMPLATE_X_FOLLOW : null) ||
          (task.type === "X_POST" ? process.env.PRIMUS_TEMPLATE_X_POST : null) ||
          (task.type === "DISCORD_JOIN" ? process.env.PRIMUS_TEMPLATE_DISCORD_JOIN : null),
        config: {
          handle: config.handle,
          mention: config.mention,
          guildId: config.guildId,
          roleId: config.roleId,
          requiredField: config.requiredField,
          request: config.request,
          responseResolves: config.responseResolves,
        },
        status: done.has(task.id) ? "verified" : "not_started",
        ownerCompletes:
          task.type === "X_FOLLOW" &&
          Boolean(config.handle),
      };
    }),
  });
}
