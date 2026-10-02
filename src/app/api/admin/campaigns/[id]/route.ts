import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function parseEndsAt(raw: unknown) {
  if (raw === null || raw === "") return null;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { endsAt?: string | null };
  if (!("endsAt" in body)) {
    return NextResponse.json({ error: "endsAt required" }, { status: 400 });
  }
  const endsAt = parseEndsAt(body.endsAt);
  if (endsAt === undefined) {
    return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { endsAt },
  });
  return NextResponse.json({ campaign: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    const tasks = await tx.task.findMany({
      where: { campaignId: campaign.id },
      select: { id: true },
    });
    const ids = tasks.map((task) => task.id);
    if (ids.length) {
      await tx.taskCompletion.deleteMany({ where: { taskId: { in: ids } } });
      await tx.task.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.campaign.delete({ where: { id: campaign.id } });
  });

  return NextResponse.json({ ok: true });
}
