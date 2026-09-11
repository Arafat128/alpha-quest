import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pkcePair, randomUrl } from "@/lib/pkce";

export async function GET(req: Request) {
  const id = process.env.X_CLIENT_ID;
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

  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/x/callback`);
  url.searchParams.set("scope", "users.read tweet.read offline.access");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(url);
}
