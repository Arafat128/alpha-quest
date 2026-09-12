import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `campaign-${Date.now()}`
  );
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaigns = await prisma.campaign.findMany({
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        select: { id: true, title: true, points: true, type: true, primusTemplateId: true, config: true },
      },
    },
    orderBy: { startsAt: "desc" },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    accent?: string;
    endsAt?: string;
  };
  const title = (body.title || "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  let slug = slugify(title);
  const clash = await prisma.campaign.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  const campaign = await prisma.campaign.create({
    data: {
      slug,
      title,
      description: (body.description || "").trim() || "New Alpha Quest campaign",
      accent: body.accent || "#38bdf8",
      startsAt: new Date(),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    },
  });
  return NextResponse.json({ campaign });
}
