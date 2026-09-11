import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await awaitDb();
    const [campaigns, users] = await Promise.all([
      prisma.campaign.count(),
      prisma.user.count(),
    ]);
    return NextResponse.json({
      ok: true,
      service: "alpha-quest",
      campaigns,
      users,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "db" },
      { status: 500 }
    );
  }
}
