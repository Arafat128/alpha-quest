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
  USER_TWEETS_REQUEST_PATTERN,
  wildcardUserByScreenNameUrl,
  wildcardXGraphqlUrl,
} from "@/lib/task-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await awaitDb();
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Log in with X or Discord first" }, { status: 401 });

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
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task) {
      taskType = task.type;
      configHandle = normalizeXHandle(parseTaskConfig(task.config).handle);
    }
  }

  wildcardSignParams(parsed, {
    taskType,
    questHandle: configHandle,
    userHandle: normalizeXHandle(user.xHandle),
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

function rewriteUrl(url: string, handle: string, taskType: string) {
  if (taskType === "X_POST") {
    if (/\/i\/api\/graphql\//i.test(url)) {
      if (/UserByScreenName/i.test(url) || /UserTweets/i.test(url)) {
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
  ctx: { taskType: string; questHandle: string; userHandle: string }
) {
  let extraHandle = "";
  try {
    const raw = parsed.additionParams;
    const extra =
      typeof raw === "string"
        ? (JSON.parse(raw) as { handle?: string })
        : raw && typeof raw === "object"
          ? (raw as { handle?: string })
          : null;
    extraHandle = normalizeXHandle(extra?.handle);
  } catch {
    extraHandle = "";
  }

  const handle = dataSourceHandle(
    ctx.taskType || (ctx.questHandle ? "X_FOLLOW" : "X_POST"),
    { handle: ctx.questHandle || extraHandle },
    ctx.userHandle || extraHandle
  );

  if (handle) {
    const launchPage = `https://x.com/${handle}`;
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
      extra.handle = handle;
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
    if (typeof rec.url === "string") rec.url = rewriteUrl(rec.url, handle, ctx.taskType);
    if (typeof rec.backUrl === "string") rec.backUrl = rewriteUrl(rec.backUrl, handle, ctx.taskType);
    if (rec.request && typeof rec.request === "object") apply(rec.request);
    if (rec.attRequest && typeof rec.attRequest === "object") apply(rec.attRequest);
  };
  apply(parsed);
}
