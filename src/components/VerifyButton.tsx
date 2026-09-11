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

export default function VerifyButton({ taskId, type, status, config, onDone }: Props) {
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

      const appId = process.env.NEXT_PUBLIC_PRIMUS_APP_ID;
      if (!appId) throw new Error("Verification is not available right now.");
      if (!config.request || !config.responseResolves?.length) {
        throw new Error("This task is not ready to verify yet.");
      }

      const { PrimusPageCoreTLS } = await import("@primuslabs/zktls-page-core-sdk");
      const zk = new PrimusPageCoreTLS();
      await zk.init(appId);

      const request = zk.generateRequestParams(
        {
          url: config.request.url,
          method: config.request.method || "GET",
          header: config.request.header || {},
          body: config.request.body || "",
        },
        config.responseResolves,
        me.user.boundAddress || undefined
      );
      request.setAdditionParams(JSON.stringify({ taskId, userId: me.user.id }));
      request.setAttMode({ algorithmType: "proxytls" });

      const unsigned = request.toJsonString();
      const signedRes = await fetch("/api/primus/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signParams: unsigned }),
      });
      const signedJson = await signedRes.json();
      if (!signedRes.ok) throw new Error(signedJson.error || "Server sign failed");

      setMsg("Generating zkTLS proof — stay logged into X in this browser…");
      const attestation = await zk.startAttestation(signedJson.signResult);

      const verifyRes = await fetch(`/api/tasks/${taskId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attestation }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyJson.error || "Backend rejected proof");
      onDone?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button className="btn-primary" disabled={busy} onClick={run}>
        {busy ? "Proving…" : "Verify"}
      </button>
      {msg && <p className="max-w-xs text-right text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
