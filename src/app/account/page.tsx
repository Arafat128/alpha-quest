"use client";

import { useEffect, useState } from "react";
import ConnectWallet from "@/components/ConnectWallet";

type Me = {
  id: string;
  displayName: string;
  walletAddress: string | null;
  xHandle: string | null;
  discordUsername: string | null;
  discordId: string | null;
  points: number;
};

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [info, setInfo] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    setMe(json.user);
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

  if (!loaded) return <p className="muted">Loading…</p>;

  if (!me) {
    return (
      <div>
        <p className="kicker">Player</p>
        <h1 className="display page-title">Account</h1>
        <p className="hero-copy">Log in with Discord to continue.</p>
        <a href="/login" className="btn-primary mt-6">
          Log in
        </a>
      </div>
    );
  }

  const discordLabel = me.discordUsername || me.discordId;
  const discordConnected = Boolean(me.discordId || me.discordUsername);

  return (
    <div className="max-w-xl">
      <p className="kicker">Player</p>
      <h1 className="display page-title">Account</h1>
      <p className="hero-copy">
        Signed in as {me.displayName}. Wallet is optional. Proofs go through Primus zkTLS.
      </p>
      <p className="points mt-3 text-sm">{me.points} points</p>

      <section className="panel">
        <p className="kicker">Social</p>
        <div className="mt-2">
          <div className="row">
            <span className="text-sm">Discord</span>
            {discordConnected ? (
              <span className="chip">Connected {discordLabel}</span>
            ) : (
              <a className="btn-ghost text-xs" href="/api/auth/discord?intent=link">
                Link Discord
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="kicker">Wallet · optional</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Not required to play. Link only if a later campaign needs an address.
        </p>
        <div className="mt-4">
          {me.walletAddress ? (
            <p className="mono text-xs">{me.walletAddress}</p>
          ) : (
            <ConnectWallet />
          )}
        </div>
      </section>
      {info && (
        <p className={`mt-4 text-sm ${info.toLowerCase().includes("already") ? "text-[var(--gold)]" : "text-[var(--cyan)]"}`}>
          {info}
        </p>
      )}
    </div>
  );
}
