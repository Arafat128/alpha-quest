import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { ensureGuest } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  getPrimusSigner,
  primusSignatureOk,
  flattenAttestationData,
  followFlagFromProof,
  extractIdentity,
  extractAttestedXHandle,
  parseAdditionParams,
} from "@/lib/primus";
import { hashAttestation, provenIdentityHash } from "@/lib/hash";
import {
  parseTaskConfig,
  sameXHandle,
  xHandleFromRequestUrl,
  normalizeXHandle,
  defaultTemplateForTask,
  HUB_X_FOLLOW_TEMPLATE_ID,
  STALE_X_FOLLOW_TEMPLATE_IDS,
} from "@/lib/task-config";
import { verifyOnChain } from "@/lib/onchain-verify";
import { Prisma } from "@prisma/client";
import { boundAddress } from "@/lib/identity";
import { logAudit, recomputeRisk } from "@/lib/risk";
import { clientIp } from "@/lib/session";
import { discordChannelId, discordGuildId } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await awaitDb();
  const { user } = await ensureGuest();

  const limited = await rateLimit(`verify:${user.id}`, 12, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many verify attempts" }, { status: 429 });
  }

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Unknown task" }, { status: 404 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: task.campaignId },
    select: { endsAt: true },
  });
  if (campaign?.endsAt && campaign.endsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "This campaign has ended" }, { status: 400 });
  }

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
  if (claimedTemplate && expectedTemplate) {
    const allowed = new Set(
      [
        expectedTemplate,
        task.primusTemplateId,
        task.type === "X_FOLLOW" ? HUB_X_FOLLOW_TEMPLATE_ID : "",
        task.type === "X_FOLLOW" ? process.env.PRIMUS_TEMPLATE_X_FOLLOW : "",
      ]
        .filter((value): value is string => Boolean(value && String(value).trim()))
        .map((value) => String(value).trim())
    );
    if (!allowed.has(claimedTemplate) && !STALE_X_FOLLOW_TEMPLATE_IDS.has(claimedTemplate)) {
      return NextResponse.json({ error: "Template mismatch" }, { status: 400 });
    }
  }

  try {
    await getPrimusSigner();
    if (!primusSignatureOk(attestation)) {
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
  const extras = (body?.extras && typeof body.extras === "object" ? body.extras : {}) as Record<string, unknown>;
  if (task.type === "DISCORD_JOIN" || task.type === "DISCORD_ROLE") {
    const guildId = discordGuildId(config.guildId);
    if (!guildId) {
      return NextResponse.json({ error: "This quest has no Discord server configured" }, { status: 400 });
    }
    const blob = JSON.stringify({ data, extras, attestation }).toLowerCase();
    const channelId = discordChannelId();
    if (!blob.includes(guildId.toLowerCase()) && !blob.includes(channelId.toLowerCase())) {
      return NextResponse.json(
        {
          error: "This proof does not show membership in the campaign Discord. Stay in that server in the tab Primus opens, then Verify again.",
        },
        { status: 400 }
      );
    }
    if (task.type === "DISCORD_ROLE" && config.roleId && !blob.includes(config.roleId.toLowerCase())) {
      return NextResponse.json(
        { error: "This proof does not include the required Discord role." },
        { status: 400 }
      );
    }
    return complete(user.id, task, "discord", user.discordId || user.id, attestation, req);
  }

  if (task.type === "X_FOLLOW") {
    const requestUrl =
      (attestation.request as { url?: string } | undefined)?.url ||
      ((attestation.attRequest as { request?: { url?: string } } | undefined)?.request?.url);
    const attestedHandle =
      extractAttestedXHandle(data, attestation) || xHandleFromRequestUrl(requestUrl || null);
    if (targetHandle && attestedHandle && !sameXHandle(attestedHandle, targetHandle)) {
      return NextResponse.json(
        {
          error: `This proof is for @${attestedHandle}, but the quest is to follow @${targetHandle}. Stay on @${targetHandle}'s profile in the tab Primus opens, then Verify again.`,
        },
        { status: 400 }
      );
    }
    const flag = followFlagFromProof(data, extras.allJsonResponse, extras.privateData, attestation);
    const isOwner = sameXHandle(user.xHandle, targetHandle);
    // Hub UserByScreenName templates often attest screen_name only. A successful
    // Primus signature is enough unless the payload explicitly says following=false.
    if (flag === false && !isOwner) {
      return NextResponse.json(
        {
          error: targetHandle
            ? `This proof shows you do not follow @${targetHandle}. Follow them on X, then Verify again.`
            : "This proof shows you do not follow that account.",
        },
        { status: 400 }
      );
    }
  }
  if (task.type === "X_POST") {
    const requestUrl =
      (attestation.request as { url?: string } | undefined)?.url ||
      ((attestation.attRequest as { request?: { url?: string } } | undefined)?.request?.url);
    const attestedHandle =
      extractAttestedXHandle(data, attestation) || xHandleFromRequestUrl(requestUrl || null);
    if (config.mention) {
      const blob = JSON.stringify({ data, extras }).toLowerCase();
      if (!blob.includes(config.mention.toLowerCase())) {
        return NextResponse.json(
          {
            error: `Post proof does not mention ${config.mention}. Post on X mentioning @${config.mention}, stay on your profile, then Verify again.`,
          },
          { status: 400 }
        );
      }
    }
  }

  const platform = task.type.startsWith("DISCORD") ? "discord" : "x";
  const identity = completerIdentity(task.type, user, data);

  return complete(user.id, task, platform, identity, attestation, req);
}

/** Who completed the quest. Follow proofs attest the target profile, not the follower. */
function completerIdentity(
  taskType: string,
  user: {
    id: string;
    xUserId: string | null;
    xHandle: string | null;
    discordId: string | null;
  },
  data: Record<string, unknown>
) {
  if (taskType === "X_FOLLOW") {
    return user.xUserId || user.xHandle || user.id;
  }
  if (taskType === "X_POST") {
    return extractIdentity(data, "x") || user.xUserId || user.xHandle || user.id;
  }
  if (taskType.startsWith("DISCORD")) {
    return user.discordId || user.id;
  }
  return extractIdentity(data, "x") || user.xUserId || user.xHandle || user.id;
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
    void logAudit({ userId, type: "VERIFY_OK", ip, detail: { taskId: task.id, platform } });
    void recomputeRisk(userId);
    return NextResponse.json({
      ok: true,
      pointsAwarded: row.pointsAwarded,
      verifiedAt: row.verifiedAt,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target || "");
      if (target.includes("userId")) {
        return NextResponse.json({ ok: true, already: true, pointsAwarded: task.points });
      }
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


