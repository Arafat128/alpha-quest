import { createHmac } from "crypto";

type OAuthPayload = {
  n: string;
  intent: string;
  uid?: string;
};

function secret() {
  return process.env.SESSION_SECRET || "quest-dev-secret-change-me-32-chars-min!!";
}

export function encodeOAuthState(payload: OAuthPayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodeOAuthState(state: string | null): OAuthPayload | null {
  if (!state || !state.includes(".")) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (expected.length !== sig.length) return null;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (ok !== 0) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthPayload;
    if (!parsed?.n) return null;
    return parsed;
  } catch {
    return null;
  }
}
