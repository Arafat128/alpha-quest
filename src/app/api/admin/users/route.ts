import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { displayName } from "@/lib/identity";
import { recomputeRisk } from "@/lib/risk";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    include: {
      completions: true,
      _count: { select: { auditEvents: true, completions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows = [];
  for (const user of users) {
    const { score, flags } = await recomputeRisk(user.id);
    const points = user.completions.reduce((s, c) => s + c.pointsAwarded, 0);
    rows.push({
      id: user.id,
      displayName: displayName(user),
      xHandle: user.xHandle,
      discordUsername: user.discordUsername,
      email: user.email,
      walletAddress: user.walletAddress,
      lastIp: user.lastIp,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      points,
      tasks: user.completions.length,
      riskScore: score,
      flags,
      suspicious: score >= 35,
    });
  }

  rows.sort((a, b) => b.riskScore - a.riskScore || b.points - a.points);
  return NextResponse.json({ users: rows });
}
