import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { defaultXFollowConfig, parseTaskConfig } from "@/lib/task-config";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    primusTemplateId?: string;
    handle?: string;
    title?: string;
  };

  const data: { primusTemplateId?: string | null; config?: string; title?: string } = {};
  if (typeof body.primusTemplateId === "string") {
    data.primusTemplateId = body.primusTemplateId.trim() || null;
  }
  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (typeof body.handle === "string" && body.handle.trim()) {
    const handle = body.handle.replace(/^@/, "").trim();
    const prev = parseTaskConfig(task.config);
    data.config = JSON.stringify({ ...prev, ...defaultXFollowConfig(handle) });
  }

  const updated = await prisma.task.update({ where: { id: task.id }, data });
  return NextResponse.json({ task: updated });
}
