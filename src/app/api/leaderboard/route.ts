import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const grouped = await prisma.taskCompletion.groupBy({
    by: ["userId"],
    _sum: { pointsAwarded: true },
    _count: { _all: true },
    orderBy: { _sum: { pointsAwarded: "desc" } },
    take: 50,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    rows: grouped.map((row, index) => {
      const user = byId.get(row.userId);
      return {
        rank: index + 1,
        userId: row.userId,
        displayName: user ? displayName(user) : row.userId.slice(0, 8),
        walletAddress: user?.walletAddress ?? "",
        xHandle: user?.xHandle ?? null,
        discordUsername: user?.discordUsername ?? null,
        points: row._sum.pointsAwarded ?? 0,
        tasks: row._count._all,
      };
    }),
  });
}
