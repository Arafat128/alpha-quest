import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { boundAddress, displayName } from "@/lib/identity";

export async function GET() {
  const { user, session } = await requireUser();
  if (!user) return NextResponse.json({ user: null, admin: Boolean(session.admin) });

  const points = await prisma.taskCompletion.aggregate({
    where: { userId: user.id },
    _sum: { pointsAwarded: true },
  });

  return NextResponse.json({
    admin: Boolean(session.admin),
    user: {
      id: user.id,
      displayName: displayName(user),
      boundAddress: boundAddress(user.id, user.walletAddress),
      walletAddress: user.walletAddress,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      xHandle: user.xHandle,
      discordUsername: user.discordUsername,
      discordId: user.discordId,
      points: points._sum.pointsAwarded ?? 0,
      riskScore: user.riskScore,
    },
  });
}
