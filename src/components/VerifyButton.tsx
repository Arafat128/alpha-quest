"use client";

import { useState } from "react";
import type { PrimusRequest, ResponseResolve } from "@/lib/task-config";

type PrimusCtor = new () => {
  init: (appId: string, appSecret?: string) => Promise<unknown>;
  generateRequestParams: (templateId: string, userAddress?: string) => {
    setAdditionParams: (v: string) => void;
    setAttMode: (v: { algorithmType: string }) => void;
    toJsonString: () => string;
  };
  startAttestation: (signed: string) => Promise<unknown>;
  verifyAttestation?: (attestation: unknown) => Promise<boolean> | boolean;
};

declare global {
  interface Window {
    PrimusZKTLS?: PrimusCtor;
    VoiceSenseZKTLS?: PrimusCtor;
  }
}

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

function waitForPrimus(ms: number) {
  return new Promise<PrimusCtor | undefined>((resolve) => {
    const start = Date.now();
    const tick = () => {
      const Ctor = window.PrimusZKTLS || window.VoiceSenseZKTLS;
      if (typeof Ctor === "function") {
        resolve(Ctor);
        return;
      }
      if (Date.now() - start >= ms) {
        resolve(undefined);
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

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
      if (!primusTemplateId) {
        throw new Error("This quest has no Primus template yet. Ask an admin to set one.");
      }

      const Ctor = await waitForPrimus(8000);
      if (typeof Ctor !== "function") {
        throw new Error(
          "Primus SDK did not load. Install the Primus Chrome extension, then refresh."
        );
      }

      setMsg("Opening Primus extension… keep the popup in front and stay logged into X.");
      const zk = new Ctor();
      await zk.init(appId);
      const request = zk.generateRequestParams(primusTemplateId, me.user.boundAddress);
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

      const attestation = await zk.startAttestation(signedJson.signResult);
      if (!attestation) throw new Error("Primus returned an empty proof");

      const verifyRes = await fetch(`/api/tasks/${taskId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attestation }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyJson.error || "Backend rejected proof");
      setMsg("");
      onDone?.();
    } catch (err) {
      setMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button className="btn-primary" data-testid="verify-btn" disabled={busy} onClick={run}>
        {busy ? "Proving…" : "Verify"}
      </button>
      {msg && <p className="max-w-xs text-right text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
