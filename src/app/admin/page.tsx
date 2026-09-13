"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tasks: {
    id: string;
    title: string;
    points: number;
    type: string;
    primusTemplateId?: string | null;
    config?: string;
  }[];
};

type UserRow = {
  id: string;
  displayName: string;
  xHandle: string | null;
  discordUsername: string | null;
  lastIp: string | null;
  points: number;
  tasks: number;
  riskScore: number;
  flags: { code: string; severity: string; label: string }[];
  suspicious: boolean;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [gateKey, setGateKey] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskCampaign, setTaskCampaign] = useState("");
  const [taskType, setTaskType] = useState("X_FOLLOW");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPoints, setTaskPoints] = useState(100);
  const [handle, setHandle] = useState("");
  const [guildId, setGuildId] = useState("");
  const [primusTemplateId, setPrimusTemplateId] = useState("");
  const [msg, setMsg] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  async function load() {
    const me = await fetch("/api/auth/me").then((r) => r.json());
    if (!me.admin) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const [c, u] = await Promise.all([
      fetch("/api/admin/campaigns").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]);
    setCampaigns(c.campaigns || []);
    setUsers(u.users || []);
    if (!taskCampaign && c.campaigns?.[0]) setTaskCampaign(c.campaigns[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  if (!authed) {
    return (
      <div className="max-w-md">
        <h1 className="display text-4xl">Admin</h1>
        <p className="mt-3 text-sm text-slate-400">Enter the admin password.</p>
        <form
          className="mt-6"
          autoComplete="off"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/admin/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password }),
            });
            const json = await res.json();
            if (!res.ok) setMsg(json.error);
            else {
              setPassword("");
              setGateKey((k) => k + 1);
              load();
            }
          }}
        >
          <input
            key={gateKey}
            type="password"
            name={`admin_gate_${gateKey}`}
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            data-testid="admin-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-primary mt-4" type="submit" data-testid="admin-enter">
            Enter
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-rose-300">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="display text-4xl">Admin</h1>
          <p className="mt-2 text-slate-400">
            Create a campaign below, then add quests (tasks) to it. Open a player account from the
            table to see standing, risk, and sybil flags.
          </p>
        </div>
        <button
          className="btn-ghost"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            setPassword("");
            setGateKey((k) => k + 1);
            setMsg("");
            setAuthed(false);
          }}
        >
          Admin sign out
        </button>
      </div>

      <section className="glass rounded-3xl p-6">
        <h2 className="text-lg font-semibold">New campaign</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            placeholder="Title"
            data-testid="campaign-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          className="btn-primary mt-4"
          onClick={async () => {
            const res = await fetch("/api/admin/campaigns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, description }),
            });
            const json = await res.json();
            setMsg(res.ok ? `Created ${json.campaign.slug}` : json.error);
            if (res.ok && json.campaign) {
              setCampaigns((prev) => [{ ...json.campaign, tasks: json.campaign.tasks || [] }, ...prev]);
              setTaskCampaign(json.campaign.id);
              setTitle("");
              setDescription("");
            }
          }}
          data-testid="create-campaign"
        >
          Create campaign
        </button>
      </section>

      <section className="glass rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Add quest / task</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            value={taskCampaign}
            onChange={(e) => setTaskCampaign(e.target.value)}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
          >
            <option value="X_FOLLOW">X follow (zkTLS)</option>
            <option value="X_POST">X post (zkTLS)</option>
            <option value="DISCORD_JOIN">Discord join</option>
            <option value="DISCORD_ROLE">Discord role</option>
            <option value="EMAIL_VERIFY">Email verify</option>
          </select>
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            placeholder="Task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <input
            type="number"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            value={taskPoints}
            onChange={(e) => setTaskPoints(Number(e.target.value))}
          />
          {taskType === "X_FOLLOW" && (
            <>
              <input
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="X handle to follow (any username, e.g. example_user)"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
              <input
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2"
                placeholder="Optional: override Primus template ID (leave blank — one template works for every X handle)"
                value={primusTemplateId}
                onChange={(e) => setPrimusTemplateId(e.target.value)}
              />
            </>
          )}
          {(taskType === "DISCORD_JOIN" || taskType === "DISCORD_ROLE") && (
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
              placeholder="Discord server ID (blank uses DISCORD_GUILD_ID)"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
            />
          )}
        </div>
        <button
          className="btn-primary mt-4"
          disabled={taskBusy}
          onClick={async () => {
            const campaignId = taskCampaign || campaigns[0]?.id;
            if (!campaignId) {
              setMsg("Create a campaign first, then add a task.");
              return;
            }
            setTaskBusy(true);
            try {
              const res = await fetch(`/api/admin/campaigns/${campaignId}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: taskType,
                  title: taskTitle,
                  points: taskPoints,
                  handle,
                  guildId,
                  primusTemplateId,
                }),
              });
              const json = await res.json();
              if (!res.ok) {
                setMsg(json.error || "Could not add task");
                return;
              }
              setMsg(`Added “${json.task.title}”`);
              setCampaigns((prev) =>
                prev.map((c) =>
                  c.id === campaignId ? { ...c, tasks: [...(c.tasks || []), json.task] } : c
                )
              );
              setTaskTitle("");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Could not add task");
            } finally {
              setTaskBusy(false);
            }
          }}
        >
          {taskBusy ? "Adding…" : "Add task"}
        </button>
        {msg && <p className="mt-3 text-sm text-sky-200">{msg}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Campaigns</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => (
            <div key={c.id} className="glass rounded-2xl p-5">
              <p className="font-semibold">{c.title}</p>
              <p className="mt-1 text-xs text-slate-500">{c.slug}</p>
              <ul className="mt-3 space-y-3 text-sm text-slate-400">
                {c.tasks.map((t) => (
                  <li key={t.id} className="rounded-xl border border-white/10 p-3">
                    <div>
                      {t.type} · {t.title} · {t.points} pts
                    </div>
                    {t.type === "X_FOLLOW" && (
                      <TaskTemplateField
                        taskId={t.id}
                        initial={t.primusTemplateId || ""}
                        onSaved={(id) => {
                          setCampaigns((prev) =>
                            prev.map((camp) =>
                              camp.id !== c.id
                                ? camp
                                : {
                                    ...camp,
                                    tasks: camp.tasks.map((x) =>
                                      x.id === t.id ? { ...x, primusTemplateId: id } : x
                                    ),
                                  }
                            )
                          );
                          setMsg("Template saved. Players can Verify with the Primus extension.");
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">User standings & risk</h2>
        <div className="glass mt-4 overflow-x-auto rounded-3xl">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Pts</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Signals</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="text-sky-200 hover:underline">
                      {u.displayName}
                    </Link>
                    <div className="text-[11px] text-slate-500">
                      {u.xHandle ? `@${u.xHandle}` : ""} {u.discordUsername || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">{u.points}</td>
                  <td className={`px-4 py-3 ${u.riskScore >= 35 ? "text-amber-300" : "text-emerald-300"}`}>
                    {u.riskScore}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.flags.length === 0
                      ? "—"
                      : u.flags.map((f) => f.code).join(", ")}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{u.lastIp || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {msg && <p className="text-sm text-sky-200">{msg}</p>}
    </div>
  );
}

function TaskTemplateField({
  taskId,
  initial,
  onSaved,
}: {
  taskId: string;
  initial: string;
  onSaved: (id: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="mt-2">
      <input
        className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
        placeholder="Optional template override (blank uses the shared follow template)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="btn-ghost mt-2 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            const res = await fetch(`/api/admin/tasks/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ primusTemplateId: value }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Save failed");
            onSaved(value.trim());
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Save failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save template ID"}
      </button>
      {err && <p className="mt-1 text-xs text-rose-300">{err}</p>}
    </div>
  );
}
