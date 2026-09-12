import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { user } = await requireUser();
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Unknown task" }, { status: 404 });
  const done =
    user &&
    (await prisma.taskCompletion.findUnique({
      where: { userId_taskId: { userId: user.id, taskId: task.id } },
    }));
  return NextResponse.json({
    id: task.id,
    type: task.type,
    status: done ? "verified" : "not_started",
  });
}
