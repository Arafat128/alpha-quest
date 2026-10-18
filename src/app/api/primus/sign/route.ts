import { NextResponse } from "next/server";
import { getPrimusSigner } from "@/lib/primus";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { boundAddress } from "@/lib/identity";
import { awaitDb, prisma } from "@/lib/prisma";
import {
  dataSourceHandle,
  normalizeXHandle,
  parseTaskConfig,
  DISCORD_MEMBER_REQUEST_PATTERN,
  USER_TWEETS_REQUEST_PATTERN,
  discordChannelUrl,
  wildcardUserByScreenNameUrl,
  wildcardXGraphqlUrl,
} from "@/lib/task-config";
import { discordGuildId } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await awaitDb();
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Log in with Discord first" }, { status: 401 });

  const limited = await rateLimit(`sign:${user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many proof requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const signParams = body?.signParams;
  if (typeof signParams !== "string" || signParams.length < 10) {
    return NextResponse.json({ error: "signParams required" }, { status: 400 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(signParams) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid signParams JSON" }, { status: 400 });
  }

  const expected = boundAddress(user.id, user.walletAddress);
  const claimedAddress = String(parsed.userAddress || "");
  if (claimedAddress && claimedAddress.toLowerCase() !== expected.toLowerCase()) {
    return NextResponse.json({ error: "Proof identity does not match session" }, { status: 403 });
  }

  const taskId = typeof body?.taskId === "string" ? body.taskId : "";
  let taskType = "";
  let configHandle = "";
  let guildId = "";
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task) {
      taskType = task.type;
      const config = parseTaskConfig(task.config);
      configHandle = normalizeXHandle(config.handle);
      guildId = discordGuildId(config.guildId);
    }
  }

  wildcardSignParams(parsed, {
    taskType,
    questHandle: configHandle,
    userHandle: normalizeXHandle(user.xHandle),
    guildId,
  });

  try {
    const zk = await getPrimusSigner();
    const signResult = await zk.sign(JSON.stringify(parsed));
    return NextResponse.json({ signResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function rewriteUrl(url: string, handle: string, taskType: string, guildId = "") {
  if (!url) return url;
  if (taskType === "DISCORD_JOIN" || taskType === "DISCORD_ROLE") {
    if (/discord\.com\/api\/.*\/users\/@me\/guilds/i.test(url)) return DISCORD_MEMBER_REQUEST_PATTERN;
    if (guildId && /^https:\/\/discord\.com\/channels\/\d+/i.test(url)) return discordChannelUrl(guildId);
    return url;
  }
  if (taskType === "X_POST") {
    if (/\/i\/api\/graphql\//i.test(url)) {
      if (/UserByScreenName/i.test(url) || /UserTweets/i.test(url) || /UserOriginalsTimeline/i.test(url)) {
        return USER_TWEETS_REQUEST_PATTERN;
      }
      return wildcardXGraphqlUrl(url);
    }
  } else {
    const named = wildcardUserByScreenNameUrl(url);
    if (named !== url) return named;
    const wild = wildcardXGraphqlUrl(url);
    if (wild !== url) return wild;
  }
  if (!handle) return url;
  const match = url.match(
    /^(https:\/\/(?:www\.)?(?:x|twitter)\.com\/)(?!i\/)([A-Za-z0-9_]+)\/?(\?.*)?$/i
  );
  if (!match) return url;
  return match[1] + handle + (match[3] || "");
}

function wildcardSignParams(
  parsed: Record<string, unknown>,
  ctx: { taskType: string; questHandle: string; userHandle: string; guildId: string }
) {
  let extraHandle = "";
  let clientLaunch = "";
  try {
    const raw = parsed.additionParams;
    const extra =
      typeof raw === "string"
        ? (JSON.parse(raw) as { handle?: string; launch_page?: string })
        : raw && typeof raw === "object"
          ? (raw as { handle?: string; launch_page?: string })
          : null;
    extraHandle = normalizeXHandle(extra?.handle);
    if (extra?.launch_page && /^https:\/\/(?:www\.)?x\.com\//i.test(extra.launch_page)) {
      clientLaunch = extra.launch_page;
    }
  } catch {
    extraHandle = "";
  }

  const discordTask = ctx.taskType === "DISCORD_JOIN" || ctx.taskType === "DISCORD_ROLE";
  const handle = discordTask
    ? ""
    : ctx.taskType
      ? dataSourceHandle(ctx.taskType, { handle: ctx.questHandle || extraHandle }, ctx.userHandle || extraHandle)
      : extraHandle || ctx.questHandle || ctx.userHandle;
  const launchPage =
    discordTask && ctx.guildId
      ? discordChannelUrl(ctx.guildId)
      : ctx.taskType === "X_POST" && clientLaunch
        ? clientLaunch
        : ctx.taskType === "X_POST"
          ? "https://x.com/home"
        : handle
          ? `https://x.com/${handle}`
          : "";

  if (launchPage) {
    const mergeLaunch = (raw: unknown) => {
      let extra: Record<string, unknown> = {};
      if (typeof raw === "string") {
        try {
          extra = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          extra = {};
        }
      } else if (raw && typeof raw === "object") {
        extra = { ...(raw as Record<string, unknown>) };
      }
      if (handle) extra.handle = handle;
      if (ctx.guildId) extra.guildId = ctx.guildId;
      extra.launch_page = launchPage;
      return JSON.stringify(extra);
    };
    if ("additionParams" in parsed) {
      parsed.additionParams = mergeLaunch(parsed.additionParams);
    }
  }
  const apply = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.url === "string") rec.url = rewriteUrl(rec.url, handle, ctx.taskType, ctx.guildId);
    if (typeof rec.backUrl === "string") rec.backUrl = rewriteUrl(rec.backUrl, handle, ctx.taskType, ctx.guildId);
    if (rec.request && typeof rec.request === "object") apply(rec.request);
    if (rec.attRequest && typeof rec.attRequest === "object") apply(rec.attRequest);
  };
  apply(parsed);
}
