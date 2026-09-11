import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
