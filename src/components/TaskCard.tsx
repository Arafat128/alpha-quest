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
      className={`task ${verified ? "is-verified" : ""} ${locked ? "is-locked" : ""} ${
        clickable ? "is-clickable" : ""
      }`}
    >
      <div>
        <p className="kicker">{task.type.replaceAll("_", " ")}</p>
        <h3>{task.title}</h3>
        <p className="desc">{task.description}</p>
        {(task.type === "DISCORD_JOIN" || task.type === "DISCORD_ROLE") && (
          <p className="desc">
            Join the server first. Primus proves you can read the campaign channel
            {task.config.inviteUrl ? (
              <>
                {" — "}
                <a
                  className="text-[var(--cyan)] hover:underline"
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
      </div>
      <div className="task-side">
        <p className="pts">{task.points} pts</p>
        <VerifyButton ref={verifyRef} taskId={task.id} {...task} onDone={onDone} />
      </div>
    </article>
  );
}
