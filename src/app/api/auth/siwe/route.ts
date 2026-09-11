import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(
      { error: "Log in with X or Discord first. Wallet is optional." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.message || !body?.signature) {
    return NextResponse.json({ error: "message and signature required" }, { status: 400 });
  }

  const message = new SiweMessage(body.message);
  const result = await message.verify({
    signature: body.signature,
    nonce: session.nonce,
  });
  if (!result.success) {
    return NextResponse.json({ error: "Invalid SIWE signature" }, { status: 401 });
  }

  const walletAddress = message.address.toLowerCase();
  const taken = await prisma.user.findFirst({
    where: { walletAddress, NOT: { id: session.userId } },
  });
  if (taken) {
    return NextResponse.json({ error: "That wallet is already linked to another account" }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { walletAddress },
  });
  session.walletAddress = walletAddress;
  session.nonce = undefined;
  await session.save();
  return NextResponse.json({ ok: true, walletAddress: user.walletAddress });
}
