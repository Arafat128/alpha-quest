import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { normalizeXHandle } from "@/lib/task-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await awaitDb();
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Log in with Discord first" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { handle?: string };
  const handle = normalizeXHandle(body.handle);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ error: "Enter a valid X username" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { xHandle: handle } });
  return NextResponse.json({ ok: true, handle });
}
