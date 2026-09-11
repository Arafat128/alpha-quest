import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { sha256 } from "@/lib/hash";

export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Log in with X or Discord first" }, { status: 401 });

  const { email, code } = (await req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
  };
  const address = (email || "").trim().toLowerCase();
  const otp = (code || "").trim();
  if (!address || !otp) {
    return NextResponse.json({ error: "email and code required" }, { status: 400 });
  }

  const row = await prisma.emailOtp.findFirst({
    where: { email: address, codeHash: sha256(otp), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: { email: address, emailVerifiedAt: new Date() },
  });
  await prisma.emailOtp.deleteMany({ where: { email: address } });

  return NextResponse.json({ ok: true });
}
