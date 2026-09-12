import { NextResponse } from "next/server";
import { getPrimusSigner } from "@/lib/primus";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { boundAddress } from "@/lib/identity";
import { prisma } from "@/lib/prisma";
import { parseTaskConfig, retargetFollowAttRequest, normalizeXHandle } from "@/lib/task-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  let addition: Record<string, string> = {};
  try {
    const raw = parsed.additionParams;
    if (typeof raw === "string" && raw.trim()) {
      addition = JSON.parse(raw) as Record<string, string>;
    }
  } catch {
    addition = {};
  }

  const taskId = addition.taskId || (typeof body?.taskId === "string" ? body.taskId : "");
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task?.type === "X_FOLLOW") {
      const handle = normalizeXHandle(parseTaskConfig(task.config).handle) || normalizeXHandle(addition.handle);
      if (handle) retargetFollowAttRequest(parsed, handle);
    }
  } else if (addition.handle) {
    retargetFollowAttRequest(parsed, addition.handle);
  }

  try {
    const zk = await getPrimusSigner();
    const signResult = await zk.sign(JSON.stringify(parsed));
    return NextResponse.json({ signResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
