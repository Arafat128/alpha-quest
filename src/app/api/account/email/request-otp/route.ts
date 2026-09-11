import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { sha256 } from "@/lib/hash";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Log in with X or Discord first" }, { status: 401 });

  const limited = await rateLimit(`otp:${user.id}`, 5, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many OTP requests" }, { status: 429 });

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const address = (email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const code = String(randomInt(100000, 999999));
  await prisma.emailOtp.create({
    data: {
      email: address,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Quest <noreply@localhost>",
        to: [address],
        subject: "Your Primus Quest code",
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
      }),
    });
    return NextResponse.json({ ok: true, delivered: true });
  }

  console.log(`[dev OTP] ${address} => ${code}`);
  return NextResponse.json({
    ok: true,
    delivered: false,
    devCode: process.env.NODE_ENV === "production" ? undefined : code,
  });
}
