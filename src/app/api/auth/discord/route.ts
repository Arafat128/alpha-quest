import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { randomUrl } from "@/lib/pkce";

export async function GET(req: Request) {
  const id = process.env.DISCORD_CLIENT_ID;
  if (!id) {
    return NextResponse.redirect(new URL("/login?error=discord_not_configured", req.url));
  }
  const origin = new URL(req.url).origin;
  const intent = new URL(req.url).searchParams.get("intent") || "login";
  const state = randomUrl(16);
  const session = await getSession();
  session.oauthState = state;
  session.oauthIntent = intent;
  await session.save();

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
