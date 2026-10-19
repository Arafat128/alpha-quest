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
  onSaved?: () => void;
  onRevert?: () => void;
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
  { taskId, type, status, primusTemplateId, config, onDone, onSaved, onRevert },
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
      const guestRes = await fetch("/api/auth/guest", { method: "POST" });
      const guest = await guestRes.json();
      if (!guest.user?.id) throw new Error("Could not start a proof session");

      let shown = false;
      await startPrimusProof({
        taskId,
        templateId: primusTemplateId,
        handle: type === "X_FOLLOW" ? config.handle : "",
        taskType: type,
        guildId: config.guildId,
        user: { id: guest.user.id, boundAddress: guest.user.boundAddress },
        onStatus: setMsg,
        onProofReady: () => {
          shown = true;
          setMsg("");
          setBusy(false);
          onDone?.();
        },
      });
      if (shown) onSaved?.();
      else onDone?.();
    } catch (err) {
      onRevert?.();
      setMsg(friendlyPrimusError(err) || errorText(err));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [config.guildId, config.handle, onDone, onRevert, onSaved, primusTemplateId, status, taskId, type]);

  useImperativeHandle(ref, () => ({ start: () => void start() }), [start]);

  if (status === "verified") {
    return <span className="status-ok">Verified</span>;
  }

  if (status === "locked") {
    return <span className="status-locked">Locked</span>;
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
      {msg ? <p className="max-w-xs text-right text-xs leading-5 text-slate-400">{msg}</p> : null}
    </div>
  );
});

export default VerifyButton;
