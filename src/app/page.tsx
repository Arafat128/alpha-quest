import Link from "next/link";
import { awaitDb, prisma } from "@/lib/prisma";
import HomeHero from "@/components/HomeHero";
import LocalTime from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await awaitDb();
  let campaigns: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    endsAt: Date | null;
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

  const taskTotal = campaigns.reduce((sum, c) => sum + c._count.tasks, 0);

  return (
    <div>
      <HomeHero campaigns={campaigns.length} tasks={taskTotal} />

      <div className="section-head" id="campaigns">
        <h2>Campaigns</h2>
        <span className="kicker" style={{ color: "var(--faint)" }}>
          {String(campaigns.length).padStart(2, "0")} open
        </span>
      </div>
      <div className="ledger">
        {campaigns.length === 0 && <div className="empty">No campaigns yet. Check back soon.</div>}
        {campaigns.map((c, i) => (
          <Link
            key={c.id}
            href={`/campaigns/${c.slug}`}
            data-testid={`campaign-${c.slug}`}
            className="campaign-row"
          >
            <span className="idx">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              {c.endsAt && (
                <p className="end-note">
                  <LocalTime
                    iso={c.endsAt.toISOString()}
                    prefix={c.endsAt.getTime() <= Date.now() ? "Ended " : "Ends "}
                  />
                </p>
              )}
            </div>
            <span className="meta">{c._count.tasks} tasks</span>
            <span className="go">Enter</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
