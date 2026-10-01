"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { friendlyPrimusError, startPrimusProof } from "@/lib/primus-client";
import type { PrimusRequest, ResponseResolve } from "@/lib/task-config";

type Props = {
  taskId: string;
  type: string;
  points: number;
  status: string;
  primusTemplateId?: string | null;
  config: {
    handle?: string;
    mention?: string;
    guildId?: string;
    inviteUrl?: string;
    roleId?: string;
    requiredField?: string;
    request?: PrimusRequest;
    responseResolves?: ResponseResolve[];
  };
  onDone?: () => void;
};

export type VerifyHandle = {
  start: () => void;
};

function errorText(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Verify failed";
  }
}

const VerifyButton = forwardRef<VerifyHandle, Props>(function VerifyButton(
  { taskId, type, status, primusTemplateId, config, onDone },
  ref
) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const running = useRef(false);

  const start = useCallback(async () => {
    if (status === "verified" || status === "locked") return;
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMsg("");
    try {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.user?.id) throw new Error("Log in with X or Discord first");

      const norm = (s?: string | null) => (s || "").replace(/^@/, "").trim().toLowerCase();
      if (
        type === "X_FOLLOW" &&
        norm(me.user.xHandle) &&
        norm(config.handle) &&
        norm(me.user.xHandle) === norm(config.handle)
      ) {
        const res = await fetch(`/api/tasks/${taskId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Verify failed");
        onDone?.();
        return;
      }

      if (type === "DISCORD_JOIN" || type === "DISCORD_ROLE") {
        if (!me.user.discordId) {
          window.location.href = "/api/auth/discord?intent=link";
          throw new Error("Connect Discord first, then click the task again.");
        }
        const res = await fetch(`/api/tasks/${taskId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Verify failed");
        onDone?.();
        return;
      }

      if (type === "EMAIL_VERIFY") {
        const res = await fetch(`/api/tasks/${taskId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Verify failed");
        onDone?.();
        return;
      }

      await startPrimusProof({
        taskId,
        templateId: primusTemplateId,
        handle: config.handle,
        user: { id: me.user.id, boundAddress: me.user.boundAddress },
        onStatus: setMsg,
      });
      setMsg("");
      onDone?.();
    } catch (err) {
      setMsg(friendlyPrimusError(err) || errorText(err));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [config.handle, onDone, primusTemplateId, status, taskId, type]);

  useImperativeHandle(ref, () => ({ start: () => void start() }), [start]);

  if (status === "verified") {
    return <span className="text-sm font-semibold text-emerald-300">Verified</span>;
  }

  if (status === "locked") {
    return <span className="text-sm font-semibold text-slate-500">Locked</span>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        className="btn-primary"
        data-testid="verify-btn"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void start();
        }}
      >
        {busy ? "Proving…" : "Verify"}
      </button>
      {msg ? <p className="max-w-xs text-right text-xs text-slate-400">{msg}</p> : null}
    </div>
  );
});

export default VerifyButton;
