import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!secret || password !== secret) {
    return NextResponse.json({ error: "Invalid admin secret" }, { status: 401 });
  }
  const session = await getSession();
  session.admin = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
