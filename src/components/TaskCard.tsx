"use client";

import VerifyButton from "./VerifyButton";

export type TaskView = {
  id: string;
  type: string;
  title: string;
  description: string;
  points: number;
  primusTemplateId?: string | null;
  status: string;
  config: {
    handle?: string;
    mention?: string;
    guildId?: string;
    roleId?: string;
    requiredField?: string;
    request?: { url: string; method: string; header?: Record<string, string>; body?: string };
    responseResolves?: { keyName: string; parsePath: string }[];
  };
};

export default function TaskCard({
  task,
  onDone,
}: {
  task: TaskView;
  onDone?: () => void;
}) {
  const verified = task.status === "verified";
  return (
    <article
      className={`glass hairline rounded-3xl p-6 ${verified ? "glow-verified" : ""} ${
        task.status === "locked" ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">{task.type}</p>
          <h3 className="mt-2 text-lg font-semibold">{task.title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{task.description}</p>
          <p className="mt-3 text-sm text-slate-300">{task.points} pts</p>
        </div>
        <VerifyButton taskId={task.id} {...task} onDone={onDone} />
      </div>
    </article>
  );
}
