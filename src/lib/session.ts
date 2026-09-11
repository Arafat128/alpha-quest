import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { awaitDb, prisma } from "./prisma";

export type SessionData = {
  nonce?: string;
  userId?: string;
  walletAddress?: string;
  admin?: boolean;
  oauthVerifier?: string;
  oauthState?: string;
  oauthIntent?: string;
};

const password =
  process.env.SESSION_SECRET || "quest-dev-secret-change-me-32-chars-min!!";

export const sessionOptions: SessionOptions = {
  password: password.length >= 32 ? password : password.padEnd(32, "!"),
  cookieName: "alpha_quest_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

export async function requireUser() {
  await awaitDb();
  const session = await getSession();
  if (!session.userId) {
    return { session, user: null as null };
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    session.destroy();
    return { session, user: null as null };
  }
  return { session, user };
}

export async function requireAdmin() {
  await awaitDb();
  const session = await getSession();
  return Boolean(session.admin);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
