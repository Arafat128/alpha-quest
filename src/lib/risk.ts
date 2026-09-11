import { prisma } from "./prisma";

export type RiskFlag = {
  code: string;
  severity: "low" | "medium" | "high";
  label: string;
};

export async function logAudit(opts: {
  userId?: string | null;
  type: string;
  ip?: string | null;
  detail?: unknown;
}) {
  await prisma.auditEvent.create({
    data: {
      userId: opts.userId || null,
      type: opts.type,
      ip: opts.ip || null,
      detail:
        typeof opts.detail === "string" ? opts.detail : JSON.stringify(opts.detail ?? {}),
    },
  });
}

export async function recomputeRisk(userId: string): Promise<{ score: number; flags: RiskFlag[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      completions: { include: { task: true } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!user) return { score: 0, flags: [] };

  const flags: RiskFlag[] = [];
  const now = Date.now();
  const ageHours = (now - user.createdAt.getTime()) / 36e5;
  const points = user.completions.reduce((s, c) => s + c.pointsAwarded, 0);

  if (user.lastIp && user.lastIp !== "unknown") {
    const sameIp = await prisma.user.count({
      where: { lastIp: user.lastIp, NOT: { id: userId } },
    });
    if (sameIp >= 2) {
      flags.push({
        code: "IP_CLUSTER",
        severity: sameIp >= 4 ? "high" : "medium",
        label: `${sameIp + 1} accounts have used IP ${user.lastIp}`,
      });
    }
  }

  const fails = user.auditEvents.filter((e) => e.type === "VERIFY_FAIL").length;
  if (fails >= 5) {
    flags.push({
      code: "VERIFY_FAILURES",
      severity: fails >= 12 ? "high" : "medium",
      label: `${fails} recent failed verifications`,
    });
  }

  const sybilBlocks = user.auditEvents.filter((e) => e.type === "SYBIL_BLOCK").length;
  if (sybilBlocks >= 1) {
    flags.push({
      code: "IDENTITY_REUSE",
      severity: "high",
      label: `${sybilBlocks} blocked attempt(s) to reuse a proven social identity on another wallet/account`,
    });
  }

  const tenMin = now - 10 * 60_000;
  const burst = user.completions.filter((c) => c.verifiedAt.getTime() >= tenMin).length;
  if (burst >= 3) {
    flags.push({
      code: "BURST_COMPLETIONS",
      severity: "medium",
      label: `${burst} tasks completed in 10 minutes`,
    });
  }

  if (ageHours < 2 && points >= 150) {
    flags.push({
      code: "NEW_ACCOUNT_HIGH_POINTS",
      severity: "high",
      label: `Account ${ageHours.toFixed(1)}h old with ${points} pts`,
    });
  }

  if (!user.xUserId && !user.discordId) {
    flags.push({
      code: "NO_SOCIAL",
      severity: "medium",
      label: "No X or Discord identity linked",
    });
  }

  if (user.xUserId && user.discordId) {
    const xClash = await prisma.user.count({
      where: { xUserId: user.xUserId, NOT: { id: userId } },
    });
    const dClash = await prisma.user.count({
      where: { discordId: user.discordId, NOT: { id: userId } },
    });
    if (xClash || dClash) {
      flags.push({
        code: "SOCIAL_COLLISION",
        severity: "high",
        label: "X or Discord id also present on another user row",
      });
    }
  }

  const score = Math.min(
    100,
    flags.reduce((s, f) => s + (f.severity === "high" ? 35 : f.severity === "medium" ? 18 : 8), 0)
  );

  await prisma.user.update({ where: { id: userId }, data: { riskScore: score } });
  return { score, flags };
}
