import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, getSession } from "@/lib/session";
import { logAudit, recomputeRisk } from "@/lib/risk";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await getSession();
  const origin = url.origin;

  if (!code || !state || state !== session.oauthState) {
    return NextResponse.redirect(new URL("/login?error=discord_denied", req.url));
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || "",
      client_secret: process.env.DISCORD_CLIENT_SECRET || "",
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/auth/discord/callback`,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) {
    return NextResponse.redirect(new URL("/login?error=discord_failed", req.url));
  }

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = (await meRes.json()) as { id?: string; username?: string };
  if (!me.id) return NextResponse.redirect(new URL("/login?error=discord_failed", req.url));

  const ip = clientIp(req);
  const intent = session.oauthIntent || "login";
  session.oauthState = undefined;
  session.oauthIntent = undefined;

  if (intent === "link" && session.userId) {
    const taken = await prisma.user.findFirst({
      where: { discordId: me.id, NOT: { id: session.userId } },
    });
    if (taken) {
      await logAudit({
        userId: session.userId,
        type: "SYBIL_BLOCK",
        ip,
        detail: { reason: "discord_already_linked", discordId: me.id },
      });
      await recomputeRisk(session.userId);
      return NextResponse.redirect(new URL("/account?error=discord_taken", req.url));
    }
    await prisma.user.update({
      where: { id: session.userId },
      data: { discordId: me.id, discordUsername: me.username || null },
    });
    await session.save();
    return NextResponse.redirect(new URL("/account?discord=linked", req.url));
  }

  let user = await prisma.user.findUnique({ where: { discordId: me.id } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        discordId: me.id,
        discordUsername: me.username || null,
        lastIp: ip,
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        discordUsername: me.username || user.discordUsername,
        lastIp: ip,
        lastLoginAt: new Date(),
      },
    });
  }

  session.userId = user.id;
  session.walletAddress = user.walletAddress || undefined;
  await session.save();
  await logAudit({ userId: user.id, type: "LOGIN", ip, detail: { provider: "discord" } });
  await recomputeRisk(user.id);
  return NextResponse.redirect(new URL("/", req.url));
}
