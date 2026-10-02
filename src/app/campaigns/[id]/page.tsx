"use client";

import { useCallback, useEffect, useState } from "react";
import TaskCard, { type TaskView } from "@/components/TaskCard";
import LocalTime from "@/components/LocalTime";

export default function CampaignPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("Campaign");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [error, setError] = useState("");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${params.id}/tasks`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load");
      return;
    }
    setTitle(json.campaign.title);
    setDescription(json.campaign.description);
    setEndsAt(json.campaign.endsAt || null);
    setEnded(Boolean(json.campaign.ended));
    setTasks(json.tasks);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const done = tasks.filter((t) => t.status === "verified").length;

  return (
    <div>
      <p className="kicker">Campaign</p>
      <h1 className="display page-title">{title}</h1>
      <p className="hero-copy">{description}</p>
      {endsAt && (
        <p className="end-note">
          <LocalTime iso={endsAt} prefix={ended ? "Ended " : "Ends "} />
        </p>
      )}
      {ended && <p className="note">This campaign is closed. New proofs are locked.</p>}
      {tasks.length > 0 && (
        <p className="kicker mt-4" style={{ color: "var(--faint)" }}>
          {done} of {tasks.length} verified
        </p>
      )}
      {error && <p className="note">{error}</p>}
      <div className="stack">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDone={load} />
        ))}
      </div>
    </div>
  );
}
