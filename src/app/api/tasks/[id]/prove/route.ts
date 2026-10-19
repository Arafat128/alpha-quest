import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { ensureGuest } from "@/lib/session";
import {
  parseTaskConfig,
  defaultXFollowConfig,
  defaultTemplateForTask,
  dataSourceHandle,
} from "@/lib/task-config";
import { boundAddress } from "@/lib/identity";
import { discordGuildId } from "@/lib/discord";
import { discordChannelUrl } from "@/lib/task-config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await awaitDb();
  const { user } = await ensureGuest();

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Unknown task" }, { status: 404 });

  const config = parseTaskConfig(task.config);
  const handle = dataSourceHandle(task.type, config, user.xHandle);
  const guildId =
    task.type === "DISCORD_JOIN" || task.type === "DISCORD_ROLE" ? discordGuildId(config.guildId) : "";
  const follow = task.type === "X_FOLLOW" && handle ? defaultXFollowConfig(handle) : null;

  return NextResponse.json({
    taskId: task.id,
    type: task.type,
    handle,
    guildId,
    launchPage: guildId ? discordChannelUrl(guildId) : "",
    templateId: defaultTemplateForTask(task.type, task.primusTemplateId),
    boundAddress: boundAddress(user.id, user.walletAddress),
    request: follow?.request || config.request || null,
    responseResolves: follow?.responseResolves || config.responseResolves || [],
  });
}
