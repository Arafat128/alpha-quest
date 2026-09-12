import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { clientIp, getSession } from "@/lib/session";
import { logAudit, recomputeRisk } from "@/lib/risk";
import { decodeOAuthState } from "@/lib/oauth-state";
import { SocialTakenError, attachDiscord } from "@/lib/merge-social";

export async function GET(req: Request) {
  try {
    return await handleDiscordCallback(req);
  } catch (error) {
    console.error("discord callback", error);
    return NextResponse.redirect(new URL("/login?error=discord_failed", req.url));
  }
}

function discordName(me: { username?: string; global_name?: string | null }) {
  return (me.global_name || me.username || "").trim() || null;
}

async function handleDiscordCallback(req: Request) {
  await awaitDb();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const packed = decodeOAuthState(url.searchParams.get("state"));
  const session = await getSession();
  const origin = url.origin;

  if (!code || !packed) {
    return NextResponse.redirect(new URL("/login?error=discord_denied", req.url));
  }
  if (session.oauthVerifier && packed.n !== session.oauthVerifier) {
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
  const me = (await meRes.json()) as {
    id?: string;
    username?: string;
    global_name?: string | null;
  };
  if (!me.id) return NextResponse.redirect(new URL("/login?error=discord_failed", req.url));

  const ip = clientIp(req);
  const intent = packed.intent || session.oauthIntent || "login";
  const linkUserId = packed.uid || session.userId;
  session.oauthVerifier = undefined;
  session.oauthState = undefined;
  session.oauthIntent = undefined;

  const name = discordName(me);

  if (intent === "link" && linkUserId) {
    try {
      await attachDiscord(linkUserId, me.id, name);
    } catch (error) {
      if (error instanceof SocialTakenError) {
        await logAudit({
          userId: linkUserId,
          type: "SYBIL_BLOCK",
          ip,
          detail: { reason: "discord_already_linked", discordId: me.id },
        });
        await recomputeRisk(linkUserId);
        return NextResponse.redirect(new URL("/account?error=discord_taken", req.url));
      }
      throw error;
    }
    session.userId = linkUserId;
    await session.save();
    await recomputeRisk(linkUserId);
    return NextResponse.redirect(new URL("/account?discord=linked", req.url));
  }

  let user = await prisma.user.findUnique({ where: { discordId: me.id } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        discordId: me.id,
        discordUsername: name,
        lastIp: ip,
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        discordUsername: name || user.discordUsername,
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
  return NextResponse.redirect(new URL("/account?discord=linked", req.url));
}
