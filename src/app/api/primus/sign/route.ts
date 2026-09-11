import { NextResponse } from "next/server";
import { getPrimusSigner } from "@/lib/primus";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { boundAddress } from "@/lib/identity";

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

  try {
    const parsed = JSON.parse(signParams) as { userAddress?: string };
    const expected = boundAddress(user.id, user.walletAddress);
    if (
      parsed.userAddress &&
      parsed.userAddress.toLowerCase() !== expected.toLowerCase()
    ) {
      return NextResponse.json({ error: "Proof identity does not match session" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid signParams JSON" }, { status: 400 });
  }

  try {
    const zk = await getPrimusSigner();
    const signResult = await zk.sign(signParams);
    return NextResponse.json({ signResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
