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

type RiskInput = {
  createdAt: Date;
  lastIp: string | null;
  xUserId: string | null;
  discordId: string | null;
  completions: { pointsAwarded: number; verifiedAt: Date }[];
  auditEvents: { type: string }[];
  sameIpOthers: number;
  socialClash: boolean;
};

export function assessRisk(input: RiskInput): { score: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  const now = Date.now();
  const ageHours = (now - input.createdAt.getTime()) / 36e5;
  const points = input.completions.reduce((s, c) => s + c.pointsAwarded, 0);

  if (input.lastIp && input.lastIp !== "unknown" && input.sameIpOthers >= 2) {
    flags.push({
      code: "IP_CLUSTER",
      severity: input.sameIpOthers >= 4 ? "high" : "medium",
      label: `${input.sameIpOthers + 1} accounts have used IP ${input.lastIp}`,
    });
  }

  const fails = input.auditEvents.filter((e) => e.type === "VERIFY_FAIL").length;
  if (fails >= 5) {
    flags.push({
      code: "VERIFY_FAILURES",
      severity: fails >= 12 ? "high" : "medium",
      label: `${fails} recent failed verifications`,
    });
  }

  const sybilBlocks = input.auditEvents.filter((e) => e.type === "SYBIL_BLOCK").length;
  if (sybilBlocks >= 1) {
    flags.push({
      code: "IDENTITY_REUSE",
      severity: "high",
      label: `${sybilBlocks} blocked attempt(s) to reuse a proven social identity on another wallet/account`,
    });
  }

  const tenMin = now - 10 * 60_000;
  const burst = input.completions.filter((c) => c.verifiedAt.getTime() >= tenMin).length;
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

  if (!input.xUserId && !input.discordId) {
    flags.push({
      code: "NO_SOCIAL",
      severity: "medium",
      label: "No X or Discord identity linked",
    });
  }

  if (input.socialClash) {
    flags.push({
      code: "SOCIAL_COLLISION",
      severity: "high",
      label: "X or Discord id also present on another user row",
    });
  }

  const score = Math.min(
    100,
    flags.reduce((s, f) => s + (f.severity === "high" ? 35 : f.severity === "medium" ? 18 : 8), 0)
  );
  return { score, flags };
}

export async function recomputeRisk(userId: string): Promise<{ score: number; flags: RiskFlag[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      completions: { select: { pointsAwarded: true, verifiedAt: true } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 50, select: { type: true } },
    },
  });
  if (!user) return { score: 0, flags: [] };

  let sameIpOthers = 0;
  if (user.lastIp && user.lastIp !== "unknown") {
    sameIpOthers = await prisma.user.count({
      where: { lastIp: user.lastIp, NOT: { id: userId } },
    });
  }

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

  await prisma.user.update({ where: { id: userId }, data: { riskScore: score } });
  return { score, flags };
}
