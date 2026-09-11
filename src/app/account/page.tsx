"use client";

import { useEffect, useState } from "react";
import ConnectWallet from "@/components/ConnectWallet";

type Me = {
  id: string;
  displayName: string;
  walletAddress: string | null;
  email: string | null;
  emailVerified: boolean;
  xHandle: string | null;
  discordUsername: string | null;
  discordId: string | null;
  points: number;
};

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    setMe(json.user);
    if (json.user?.email) setEmail(json.user.email);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get("discord") === "linked") setInfo("Discord connected.");
    if (q.get("x") === "linked") setInfo("X connected.");
    if (q.get("error") === "discord_taken") setInfo("That Discord account is already used on another player.");
    if (q.get("error") === "x_taken") setInfo("That X account is already used on another player.");
  }, []);

  if (!loaded) return <p className="text-slate-400">Loading…</p>;

  if (!me) {
    return (
      <div>
        <h1 className="display text-5xl">Account</h1>
        <p className="mt-4 text-slate-400">Log in with X or Discord to continue.</p>
        <a href="/login" className="btn-primary mt-6 inline-flex">
          Log in
        </a>
      </div>
    );
  }

  const discordLabel = me.discordUsername || me.discordId;
  const discordConnected = Boolean(me.discordId || me.discordUsername);

  return (
    <div className="max-w-xl">
      <h1 className="display text-5xl">Account</h1>
      <p className="mt-3 text-slate-400">
        Signed in as {me.displayName}. Wallet is optional. X proofs still go through Primus zkTLS.
      </p>
      <p className="mt-2 text-sm text-sky-200">{me.points} points</p>

      <section className="glass mt-8 rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Social</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">X</span>
            {me.xHandle ? (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">
                Connected @{me.xHandle}
              </span>
            ) : (
              <a className="btn-ghost text-xs" href="/api/auth/x?intent=link">
                Link X
              </a>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">Discord</span>
            {discordConnected ? (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">
                Connected {discordLabel}
              </span>
            ) : (
              <a className="btn-ghost text-xs" href="/api/auth/discord?intent=link">
                Link Discord
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="glass mt-5 rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Email OTP</p>
        <input
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="btn-ghost mt-3"
          onClick={async () => {
            const res = await fetch("/api/account/email/request-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const json = await res.json();
            setInfo(json.devCode ? `Dev code: ${json.devCode}` : json.error || "Code sent");
          }}
        >
          Send code
        </button>
        <input
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          className="btn-primary mt-3"
          onClick={async () => {
            const res = await fetch("/api/account/email/verify-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, code }),
            });
            const json = await res.json();
            if (!res.ok) setInfo(json.error);
            else {
              setInfo("Email verified");
              load();
            }
          }}
        >
          Confirm email
        </button>
        {me.emailVerified && <p className="mt-2 text-sm text-emerald-300">Verified {me.email}</p>}
      </section>

      <section className="glass mt-5 rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Wallet (optional)</p>
        <p className="mt-2 text-sm text-slate-400">
          Not required to play. Link only if a later campaign needs an address.
        </p>
        <div className="mt-4">
          {me.walletAddress ? (
            <p className="font-mono text-xs">{me.walletAddress}</p>
          ) : (
            <ConnectWallet />
          )}
        </div>
      </section>
      {info && <p className="mt-4 text-sm text-sky-200">{info}</p>}
    </div>
  );
}
