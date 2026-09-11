"use client";

import { useCallback, useEffect, useState } from "react";
import TaskCard, { type TaskView } from "@/components/TaskCard";

export default function CampaignPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("Campaign");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${params.id}/tasks`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load");
      return;
    }
    setTitle(json.campaign.title);
    setDescription(json.campaign.description);
    setTasks(json.tasks);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Campaign</p>
      <h1 className="display mt-3 text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-slate-400">{description}</p>
      {error && <p className="mt-4 text-rose-300">{error}</p>}
      <div className="mt-10 space-y-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDone={load} />
        ))}
      </div>
    </div>
  );
}
