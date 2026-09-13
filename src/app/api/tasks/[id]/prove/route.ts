import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseTaskConfig, defaultXFollowConfig, normalizeXHandle, defaultTemplateForTask } from "@/lib/task-config";
import { boundAddress } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await awaitDb();
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Log in with X or Discord first" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Unknown task" }, { status: 404 });

  const config = parseTaskConfig(task.config);
  const handle = normalizeXHandle(config.handle);
  const follow = task.type === "X_FOLLOW" && handle ? defaultXFollowConfig(handle) : null;

  return NextResponse.json({
    taskId: task.id,
    type: task.type,
    handle,
    templateId: defaultTemplateForTask(task.type, task.primusTemplateId),
    boundAddress: boundAddress(user.id, user.walletAddress),
    request: follow?.request || config.request || null,
    responseResolves: follow?.responseResolves || config.responseResolves || [],
  });
}
