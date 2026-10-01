"use client";

import { useRef } from "react";
import VerifyButton, { type VerifyHandle } from "./VerifyButton";

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
    inviteUrl?: string;
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
  const verifyRef = useRef<VerifyHandle>(null);
  const verified = task.status === "verified";
  const locked = task.status === "locked";
  const clickable = !verified && !locked;

  function startVerify() {
    if (!clickable) return;
    verifyRef.current?.start();
  }

  return (
    <article
      data-testid="task-card"
      onClick={clickable ? startVerify : undefined}
      className={`glass hairline rounded-3xl p-6 ${verified ? "glow-verified" : ""} ${
        locked ? "opacity-40" : ""
      } ${clickable ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">{task.type}</p>
          <h3 className="mt-2 text-lg font-semibold">{task.title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{task.description}</p>
          {(task.type === "DISCORD_JOIN" || task.type === "DISCORD_ROLE") && (
            <p className="mt-2 text-sm text-slate-400">
              Join the server first. We check Discord membership with the bot
              {task.config.inviteUrl ? (
                <>
                  {" — "}
                  <a
                    className="text-sky-300 hover:underline"
                    href={task.config.inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    open Discord
                  </a>
                </>
              ) : null}
              .
            </p>
          )}
          <p className="mt-3 text-sm text-slate-300">{task.points} pts</p>
        </div>
        <VerifyButton ref={verifyRef} taskId={task.id} {...task} onDone={onDone} />
      </div>
    </article>
  );
}
