"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminUserPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/users/${params.id}`);
    const json = await res.json();
    setData(json.user);
    setNotes(json.user?.notes || "");
  }

  useEffect(() => {
    load();
  }, [params.id]);

  if (!data) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-sm text-sky-200">
        ← Admin
      </Link>
      <h1 className="display mt-4 text-4xl">{data.displayName}</h1>
      <p className="mt-2 text-sm text-slate-400">
        Risk {data.riskScore} · {data.points} pts · created {new Date(data.createdAt).toLocaleString()}
      </p>

      <section className="glass mt-6 rounded-3xl p-6 text-sm">
        <p>X: {data.xHandle ? `@${data.xHandle}` : "—"} ({data.xUserId || "no id"})</p>
        <p className="mt-1">Discord: {data.discordUsername || "—"} ({data.discordId || "no id"})</p>
        <p className="mt-1">Email: {data.email || "—"}</p>
        <p className="mt-1 font-mono text-xs">Wallet: {data.walletAddress || "—"}</p>
        <p className="mt-1 font-mono text-xs">Last IP: {data.lastIp || "—"}</p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Sybil / suspicion flags</h2>
        <ul className="mt-3 space-y-2">
          {(data.flags || []).length === 0 && <li className="text-slate-500">No flags</li>}
          {(data.flags || []).map((f: { code: string; severity: string; label: string }) => (
            <li key={f.code} className="glass rounded-2xl px-4 py-3 text-sm">
              <span className={f.severity === "high" ? "text-rose-300" : "text-amber-200"}>
                {f.severity}
              </span>{" "}
              · {f.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Completions</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {data.completions?.map((c: any) => (
            <li key={c.id} className="glass rounded-2xl px-4 py-3">
              {c.task?.campaign?.title} / {c.task?.title} · {c.pointsAwarded} pts ·{" "}
              {new Date(c.verifiedAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Audit</h2>
        <ul className="mt-3 max-h-80 space-y-1 overflow-auto text-xs text-slate-400">
          {data.auditEvents?.map((e: any) => (
            <li key={e.id}>
              {new Date(e.createdAt).toLocaleString()} · {e.type} · {e.ip} · {e.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Operator notes</h2>
        <textarea
          className="mt-3 h-28 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          className="btn-primary mt-3"
          onClick={async () => {
            const res = await fetch(`/api/admin/users/${params.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes }),
            });
            setMsg(res.ok ? "Saved" : "Failed");
          }}
        >
          Save notes
        </button>
        {msg && <p className="mt-2 text-sm text-sky-200">{msg}</p>}
      </section>
    </div>
  );
}
