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
        setMsg("You are the account owner — completing this quest.");
        const res = await fetch(`/api/tasks/${taskId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Verify failed");
        setMsg("");
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

      const appId = process.env.NEXT_PUBLIC_PRIMUS_APP_ID;
      if (!appId) throw new Error("Verification is not available right now.");

      const target = norm(config.handle);
      const useHubTemplate =
        Boolean(primusTemplateId) && (!target || target === "example_owner");

      let unsigned = "";
      let startAttestation: (signed: string) => Promise<unknown>;

      if (useHubTemplate && primusTemplateId) {
        const Ctor = await waitForPrimus(8000);
        if (typeof Ctor !== "function") {
          throw new Error(
            "Primus SDK did not load. Install the Primus Chrome extension, then refresh."
          );
        }
        setMsg(
          `Opening Primus… prove follow of @${config.handle || "example_owner"}. Stay logged into X.`
        );
        const zk = new Ctor();
        await zk.init(appId);
        const request = zk.generateRequestParams(primusTemplateId, me.user.boundAddress);
        request.setAdditionParams(JSON.stringify({ taskId, userId: me.user.id, handle: config.handle }));
        request.setAttMode({ algorithmType: "proxytls" });
        unsigned = request.toJsonString();
        startAttestation = (signed) => zk.startAttestation(signed);
      } else {
        if (!config.request?.url || !config.responseResolves?.length) {
          throw new Error("This follow quest has no target account configured.");
        }
        if (target) {
          window.open(`https://x.com/${target}`, "_blank", "noopener");
        }
        setMsg(
          `Opening Primus extension to prove follow of @${config.handle}. Stay logged into X on that profile.`
        );
        const { PrimusExtCoreTLS } = await import("@primuslabs/zktls-ext-core-sdk");
        const zk = new PrimusExtCoreTLS();
        await zk.init(appId);
        const request = zk.generateRequestParams(
          {
            url: config.request.url,
            method: config.request.method || "GET",
            header: config.request.header || {},
            body: config.request.body || "",
          },
          config.responseResolves,
          me.user.boundAddress
        );
        request.setAdditionParams(JSON.stringify({ taskId, userId: me.user.id, handle: config.handle }));
        request.setAttMode({ algorithmType: "proxytls" });
        unsigned = request.toJsonString();
        const Ctor = await waitForPrimus(4000);
        if (typeof Ctor === "function") {
          const ext = new Ctor();
          await ext.init(appId);
          startAttestation = (signed) => ext.startAttestation(signed);
        } else {
          startAttestation = (signed) => zk.startAttestation(signed);
        }
      }

      const signedRes = await fetch("/api/primus/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signParams: unsigned }),
      });
      const signedJson = await signedRes.json();
      if (!signedRes.ok) throw new Error(signedJson.error || "Server sign failed");

      const attestation = await startAttestation(signedJson.signResult);
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
