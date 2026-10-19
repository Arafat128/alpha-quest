"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TaskCard, { type TaskView } from "./TaskCard";

const DEMO_SLUG = "genesis-attestation";

export default function TaskBoard() {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    const res = await fetch(`/api/campaigns/${DEMO_SLUG}/tasks`);
    const json = await res.json();
    if (gen !== loadGen.current) return;
    if (!res.ok) {
      setError(json.error || "Could not load proofs");
      setReady(true);
      return;
    }
    setError("");
    setTasks(json.tasks || []);
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section id="proofs">
      <div className="section-head">
        <h2>Proofs</h2>
        <span className="kicker" style={{ color: "var(--faint)" }}>
          {ready ? `${tasks.filter((task) => task.status === "verified").length} of ${tasks.length} done` : "Loading"}
        </span>
      </div>
      {error && <p className="note">{error}</p>}
      <div className="stack">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDone={() => {
              setTasks((current) =>
                current.map((item) => (item.id === task.id ? { ...item, status: "verified" } : item))
              );
            }}
            onSaved={() => {
              void load();
            }}
            onRevert={() => {
              setTasks((current) =>
                current.map((item) =>
                  item.id === task.id && item.status === "verified" ? { ...item, status: "not_started" } : item
                )
              );
            }}
          />
        ))}
      </div>
    </section>
  );
}
