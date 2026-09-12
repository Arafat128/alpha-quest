"use client";

import { useState } from "react";
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
    roleId?: string;
    requiredField?: string;
    request?: PrimusRequest;
    responseResolves?: ResponseResolve[];
  };
  onDone?: () => void;
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

export default function VerifyButton({
  taskId,
  type,
  status,
  primusTemplateId,
  config,
  onDone,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (status === "verified") {
    return <span className="text-sm font-semibold text-emerald-300">Verified</span>;
  }

  async function run() {
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

      if (type === "EMAIL_VERIFY" || type === "DISCORD_JOIN" || type === "DISCORD_ROLE") {
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

      const prove = new URL("/prove.html", window.location.origin);
      prove.searchParams.set("task", taskId);
      if (primusTemplateId) prove.searchParams.set("template", primusTemplateId);
      prove.searchParams.set("handle", config.handle || "");
      const popup = window.open(prove.toString(), "alpha-quest-prove", "popup=yes,width=540,height=760");
      if (!popup) {
        throw new Error("Allow popups for Alpha Quest so the Primus extension can open.");
      }
      setMsg("Complete the Primus popup in the new tab. This page will update when it succeeds.");

      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetch(`/api/tasks/${taskId}`).then((r) => r.json());
        if (st.status === "verified") {
          setMsg("");
          onDone?.();
          return;
        }
      }
      setMsg("Still waiting for the Primus tab. Finish the popup, or click Verify again.");
    } catch (err) {
      setMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button className="btn-primary" data-testid="verify-btn" disabled={busy} onClick={run}>
        {busy ? "Waiting…" : "Verify"}
      </button>
      {msg && <p className="max-w-xs text-right text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
