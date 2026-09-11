"use client";

import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";
import { useCallback, useEffect, useState } from "react";
import { SiweMessage } from "siwe";

export default function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [sessionAddr, setSessionAddr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    setSessionAddr(json.user?.walletAddress ?? null);
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe, address]);

  async function siwe() {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Primus Quest. Wallet is your primary identity.",
        uri: window.location.origin,
        version: "1",
        chainId: chainId || 1,
        nonce,
      });
      const signature = await signMessageAsync({ message: message.prepareMessage() });
      const verify = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const body = await verify.json();
      if (!verify.ok) throw new Error(body.error || "SIWE failed");
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (sessionAddr) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-xs text-sky-200 sm:inline">
          {sessionAddr.slice(0, 6)}…{sessionAddr.slice(-4)}
        </span>
        <button
          className="btn-ghost"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            disconnect();
            setSessionAddr(null);
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!isConnected ? (
        <button
          className="btn-primary"
          disabled={isPending}
          onClick={() => connect({ connector: injected() })}
        >
          Connect wallet
        </button>
      ) : (
        <button className="btn-primary" disabled={busy} onClick={siwe}>
          {busy ? "Signing…" : "Link wallet"}
        </button>
      )}
      {error && <span className="max-w-48 text-right text-[11px] text-rose-300">{error}</span>}
    </div>
  );
}
