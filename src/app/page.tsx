import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HomeHero from "@/components/HomeHero";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let campaigns: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    _count: { tasks: number };
  }> = [];
  try {
    campaigns = await prisma.campaign.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { startsAt: "desc" },
    });
  } catch {
    campaigns = [];
  }

  return (
    <div>
      <HomeHero />

      <h2 id="campaigns" className="mt-12 text-sm uppercase tracking-[0.2em] text-slate-400">
        Campaigns
      </h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {campaigns.length === 0 && (
          <div className="glass rounded-3xl p-8 text-slate-400">
            No campaigns yet. Check back soon.
          </div>
        )}
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/campaigns/${c.slug}`}
            className="glass hairline group rounded-3xl p-7 transition hover:-translate-y-0.5"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">
              {c._count.tasks} tasks
            </p>
            <h3 className="display mt-3 text-3xl">{c.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">{c.description}</p>
            <span className="mt-6 inline-block text-sm text-sky-200 group-hover:underline">
              Enter campaign →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
