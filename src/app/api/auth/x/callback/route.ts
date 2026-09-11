import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { clientIp, getSession } from "@/lib/session";
import { logAudit, recomputeRisk } from "@/lib/risk";

export async function GET(req: Request) {
  try {
    return await handleXCallback(req);
  } catch (error) {
    console.error("x callback", error);
    return NextResponse.redirect(new URL("/login?error=x_failed", req.url));
  }
}

async function handleXCallback(req: Request) {
  await awaitDb();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await getSession();
  const origin = url.origin;

  if (!code || !state || state !== session.oauthState || !session.oauthVerifier) {
    return NextResponse.redirect(new URL("/login?error=x_denied", req.url));
  }

  const clientId = (process.env.X_CLIENT_ID || "").trim();
  const clientSecret = (process.env.X_CLIENT_SECRET || "").trim();
  const redirectUri = `${origin}/api/auth/x/callback`;
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: session.oauthVerifier,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) {
    return NextResponse.redirect(new URL("/login?error=x_failed", req.url));
  }

  const meRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = (await meRes.json()) as { data?: { id: string; username: string } };
  if (!me.data) return NextResponse.redirect(new URL("/login?error=x_failed", req.url));

  const ip = clientIp(req);
  const intent = session.oauthIntent || "login";
  session.oauthVerifier = undefined;
  session.oauthState = undefined;
  session.oauthIntent = undefined;

  if (intent === "link" && session.userId) {
    const taken = await prisma.user.findFirst({
      where: { xUserId: me.data.id, NOT: { id: session.userId } },
    });
    if (taken) {
      await logAudit({
        userId: session.userId,
        type: "SYBIL_BLOCK",
        ip,
        detail: { reason: "x_already_linked", xUserId: me.data.id },
      });
      await recomputeRisk(session.userId);
      return NextResponse.redirect(new URL("/account?error=x_taken", req.url));
    }
    await prisma.user.update({
      where: { id: session.userId },
      data: { xUserId: me.data.id, xHandle: me.data.username },
    });
    await session.save();
    return NextResponse.redirect(new URL("/account?x=linked", req.url));
  }

  let user = await prisma.user.findUnique({ where: { xUserId: me.data.id } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        xUserId: me.data.id,
        xHandle: me.data.username,
        lastIp: ip,
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { xHandle: me.data.username, lastIp: ip, lastLoginAt: new Date() },
    });
  }

  session.userId = user.id;
  session.walletAddress = user.walletAddress || undefined;
  await session.save();
  await logAudit({ userId: user.id, type: "LOGIN", ip, detail: { provider: "x" } });
  await recomputeRisk(user.id);
  return NextResponse.redirect(new URL("/", req.url));
}
