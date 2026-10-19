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

function openQuip(type: string) {
  if (type === "X_FOLLOW") return "Prove the follow. The rest of the timeline stays put.";
  if (type === "X_POST") return "One post is enough. The drafts stay yours.";
  if (type === "DISCORD_JOIN" || type === "DISCORD_ROLE") return "Prove you can open the door. The chat stays in Discord.";
  return "One fact, checked. Everything else stays in the browser.";
}

function doneQuip(type: string) {
  if (type === "X_FOLLOW") return "Followed, and proved. Nothing else left the tab.";
  if (type === "X_POST") return "That post counts. The other ones do not.";
  if (type === "DISCORD_JOIN" || type === "DISCORD_ROLE") return "You are in. The memes were not part of the deal.";
  return "Proved. The private bits never made the trip.";
}

export default function TaskCard({
  task,
  onDone,
  onSaved,
  onRevert,
}: {
  task: TaskView;
  onDone?: () => void;
  onSaved?: () => void;
  onRevert?: () => void;
}) {
  const verifyRef = useRef<VerifyHandle>(null);
  const verified = task.status === "verified";
  const locked = task.status === "locked";
  const clickable = !verified && !locked;

  function startVerify() {
    if (!clickable) return;
    verifyRef.current?.start();
  }

  const quip = verified ? doneQuip(task.type) : openQuip(task.type);

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
        <p className="pts">{quip}</p>
        <VerifyButton
          ref={verifyRef}
          taskId={task.id}
          {...task}
          onDone={onDone}
          onSaved={onSaved}
          onRevert={onRevert}
        />
      </div>
    </article>
  );
}
