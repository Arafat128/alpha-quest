import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { displayName } from "@/lib/identity";
import { recomputeRisk } from "@/lib/risk";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      completions: { include: { task: { include: { campaign: true } } }, orderBy: { verifiedAt: "desc" } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 80 },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { score, flags } = await recomputeRisk(user.id);
  return NextResponse.json({
    user: {
      ...user,
      displayName: displayName(user),
      points: user.completions.reduce((s, c) => s + c.pointsAwarded, 0),
      riskScore: score,
      flags,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { notes } = (await req.json().catch(() => ({}))) as { notes?: string };
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { notes: notes ?? "" },
  });
  return NextResponse.json({ ok: true, notes: user.notes });
}
