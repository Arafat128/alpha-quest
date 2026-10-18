import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { displayName } from "@/lib/identity";
import { assessRisk } from "@/lib/risk";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    include: {
      completions: { select: { pointsAwarded: true, verifiedAt: true } },
      auditEvents: {
        where: { type: { in: ["VERIFY_FAIL", "SYBIL_BLOCK"] } },
        select: { type: true },
        take: 50,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const ips = Array.from(
    new Set(users.map((user) => user.lastIp).filter((ip): ip is string => Boolean(ip && ip !== "unknown")))
  );
  const ipRows = ips.length
    ? await prisma.user.groupBy({
        by: ["lastIp"],
        where: { lastIp: { in: ips } },
        _count: { _all: true },
      })
    : [];
  const ipCount = new Map(ipRows.map((row) => [row.lastIp, row._count._all]));

  const rows = [];
  for (const user of users) {
    const sameIpOthers =
      user.lastIp && user.lastIp !== "unknown" ? Math.max(0, (ipCount.get(user.lastIp) || 1) - 1) : 0;
    const { score, flags } = assessRisk({
      createdAt: user.createdAt,
      lastIp: user.lastIp,
      xUserId: user.xUserId,
      discordId: user.discordId,
      completions: user.completions,
      auditEvents: user.auditEvents,
      sameIpOthers,
      socialClash: false,
    });
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
