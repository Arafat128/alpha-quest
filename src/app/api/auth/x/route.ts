import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pkcePair, randomUrl } from "@/lib/pkce";

export async function GET(req: Request) {
  const id = (process.env.X_CLIENT_ID || "").trim();
  const origin = new URL(req.url).origin;
  if (!id) {
    return NextResponse.redirect(new URL("/login?error=x_not_configured", req.url));
  }

  const intent = new URL(req.url).searchParams.get("intent") || "login";
  const { verifier, challenge } = pkcePair();
  const state = randomUrl(16);
  const session = await getSession();
  session.oauthVerifier = verifier;
  session.oauthState = state;
  session.oauthIntent = intent;
  await session.save();

  const redirectUri = `${origin}/api/auth/x/callback`;
  const authorize =
    "https://x.com/i/oauth2/authorize" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(id)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent("tweet.read users.read")}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=S256`;
  return NextResponse.redirect(authorize);
}
