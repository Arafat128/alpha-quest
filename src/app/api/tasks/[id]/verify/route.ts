import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  getPrimusSigner,
  flattenAttestationData,
  fieldLooksTrue,
  extractIdentity,
  extractAttestedXHandle,
  parseAdditionParams,
} from "@/lib/primus";
import { hashAttestation, provenIdentityHash } from "@/lib/hash";
import { parseTaskConfig, sameXHandle, xHandleFromRequestUrl, normalizeXHandle, defaultTemplateForTask } from "@/lib/task-config";
import { verifyOnChain } from "@/lib/onchain-verify";
import { Prisma } from "@prisma/client";
import { boundAddress } from "@/lib/identity";
import { logAudit, recomputeRisk } from "@/lib/risk";
import { clientIp } from "@/lib/session";
import { discordGuildId, fetchDiscordMember } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await awaitDb();
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Log in with X or Discord first" }, { status: 401 });

  const limited = await rateLimit(`verify:${user.id}`, 12, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many verify attempts" }, { status: 429 });
  }

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Unknown task" }, { status: 404 });

  const existing = await prisma.taskCompletion.findUnique({
    where: { userId_taskId: { userId: user.id, taskId: task.id } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, already: true, pointsAwarded: existing.pointsAwarded });
  }

  const body = await req.json().catch(() => null);
  const config = parseTaskConfig(task.config);
  const targetHandle = normalizeXHandle(config.handle);

  if (task.type === "X_FOLLOW" && sameXHandle(user.xHandle, targetHandle)) {
    return complete(
      user.id,
      task,
      "x",
      user.xUserId || user.xHandle || user.id,
      { source: "x-oauth-owner", handle: user.xHandle },
      req
    );
  }

  if (task.type === "EMAIL_VERIFY") {
    if (!user.emailVerifiedAt) {
      return NextResponse.json({ error: "Verify email on the Account page first" }, { status: 400 });
    }
    return complete(user.id, task, "email", user.email || user.id, { source: "email-otp" }, req);
  }

  if (task.type === "DISCORD_JOIN" || task.type === "DISCORD_ROLE") {
    if (!user.discordId) {
      return NextResponse.json({ error: "Connect Discord on the Account page first" }, { status: 400 });
    }
    const guildId = discordGuildId(config.guildId);
    if (!guildId) {
      return NextResponse.json({ error: "This quest has no Discord server configured" }, { status: 400 });
    }
    const member = await fetchDiscordMember(guildId, user.discordId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: 400 });
    }
    if (task.type === "DISCORD_ROLE" && config.roleId) {
      const roles = Array.isArray(member.roles) ? member.roles : [];
      if (!roles.includes(config.roleId)) {
        return NextResponse.json({ error: "That Discord role is not on your account yet" }, { status: 400 });
      }
    }
    return complete(user.id, task, "discord", user.discordId, { source: "discord-bot", guildId }, req);
  }

  const attestation = body?.attestation as Record<string, unknown> | undefined;
  if (!attestation || typeof attestation !== "object") {
    return NextResponse.json(
      { error: "Attestation required for this task. Stay logged into X/Discord in this browser." },
      { status: 400 }
    );
  }

  const addition = parseAdditionParams(attestation);
  if (addition.userId && addition.userId !== user.id) {
    return NextResponse.json({ error: "Proof is bound to a different user" }, { status: 403 });
  }
  if (addition.taskId && addition.taskId !== task.id) {
    return NextResponse.json({ error: "Proof is bound to a different task" }, { status: 403 });
  }

  const recipient = String(attestation.recipient || "").toLowerCase();
  const expected = boundAddress(user.id, user.walletAddress).toLowerCase();
  if (recipient && recipient !== "0x0000000000000000000000000000000000000000") {
    if (recipient !== expected) {
      return NextResponse.json({ error: "Attestation recipient is not this account" }, { status: 403 });
    }
  }

  const expectedTemplate = defaultTemplateForTask(task.type, task.primusTemplateId);
  const claimedTemplate = String(
    attestation.templateId ||
      attestation.templateID ||
      attestation.attTemplateID ||
      (attestation.attRequest as Record<string, unknown> | undefined)?.attTemplateID ||
      ""
  );
  if (claimedTemplate && expectedTemplate && claimedTemplate !== expectedTemplate && claimedTemplate !== task.primusTemplateId) {
    return NextResponse.json({ error: "Template mismatch" }, { status: 400 });
  }

  try {
    const zk = await getPrimusSigner();
    const sigOk = zk.verifyAttestation(attestation as never);
    if (sigOk !== true) {
      return NextResponse.json({ error: "Primus signature check failed" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Primus verify failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const chain = await verifyOnChain(attestation);
  if (chain.attempted && !chain.ok) {
    return NextResponse.json({ error: "On-chain verifier rejected attestation" }, { status: 400 });
  }

  const data = flattenAttestationData(attestation);
  const required = config.requiredField || (task.type === "X_FOLLOW" ? "following" : "");
  if (task.type === "X_FOLLOW") {
    const requestUrl =
      (attestation.request as { url?: string } | undefined)?.url ||
      ((attestation.attRequest as { request?: { url?: string } } | undefined)?.request?.url);
    const attestedHandle =
      extractAttestedXHandle(data, attestation) || xHandleFromRequestUrl(requestUrl || null);
    if (targetHandle && attestedHandle && !sameXHandle(attestedHandle, targetHandle)) {
      return NextResponse.json(
        {
          error: `This proof is for @${attestedHandle}, but the quest is to follow @${targetHandle}. Follow that account on X, then Verify again.`,
        },
        { status: 400 }
      );
    }
    const followed = required ? fieldLooksTrue(data, required) : false;
    const isOwner = sameXHandle(user.xHandle, targetHandle);
    if (!followed && !isOwner) {
      return NextResponse.json(
        {
          error: targetHandle
            ? `This proof does not show that you follow @${targetHandle}. Follow them on X, stay logged in, then Verify again.`
            : "This proof does not show a follow.",
        },
        { status: 400 }
      );
    }
  }
  if (task.type === "X_POST" && config.mention) {
    const blob = JSON.stringify(data).toLowerCase();
    if (!blob.includes(config.mention.toLowerCase())) {
      return NextResponse.json({ error: `Post proof does not mention ${config.mention}` }, { status: 400 });
    }
  }

  const platform = task.type.startsWith("DISCORD") ? "discord" : "x";
  const identity =
    extractIdentity(data, platform) ||
    (platform === "x" ? user.xUserId || user.xHandle : user.discordId) ||
    user.id;

  return complete(user.id, task, platform, identity, attestation, req);
}

async function complete(
  userId: string,
  task: { id: string; points: number },
  platform: string,
  identity: string,
  attestation: unknown,
  req: Request
) {
  const identityHash = provenIdentityHash(platform, String(identity));
  const ip = clientIp(req);
  try {
    const row = await prisma.taskCompletion.create({
      data: {
        userId,
        taskId: task.id,
        attestationHash: hashAttestation(attestation),
        provenIdentityHash: identityHash,
        pointsAwarded: task.points,
      },
    });
    await logAudit({ userId, type: "VERIFY_OK", ip, detail: { taskId: task.id, platform } });
    await recomputeRisk(userId);
    return NextResponse.json({
      ok: true,
      pointsAwarded: row.pointsAwarded,
      verifiedAt: row.verifiedAt,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await logAudit({
        userId,
        type: "SYBIL_BLOCK",
        ip,
        detail: { taskId: task.id, platform, identityHash },
      });
      await recomputeRisk(userId);
      return NextResponse.json(
        { error: "This social identity already completed the task on another account" },
        { status: 409 }
      );
    }
    throw error;
  }
}


