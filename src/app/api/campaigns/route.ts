import { NextResponse } from "next/server";
import { awaitDb, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await awaitDb();
  const campaigns = await prisma.campaign.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { startsAt: "desc" },
  });
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      accent: c.accent,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      taskCount: c._count.tasks,
    })),
  });
}
