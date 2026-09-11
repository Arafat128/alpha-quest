"use client";

import { useEffect, useState } from "react";

export default function HomeHero() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        setLoggedIn(Boolean(j.user));
        setName(j.user?.displayName || "");
      })
      .catch(() => setLoggedIn(false));
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 px-8 py-16 md:px-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.22),transparent_42%)]" />
      <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Alpha Quest</p>
      <h1 className="display mt-4 max-w-3xl text-5xl leading-[1.05] md:text-6xl">
        Prove the action.
        <em className="block text-sky-200/90"> Keep the session yours.</em>
      </h1>
      <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
        {loggedIn
          ? `Signed in as ${name}. Open a campaign and verify tasks — X actions still use Primus zkTLS.`
          : "Log in with X or Discord — no wallet required. Follows and posts are attested with Primus zkTLS from your browser session."}
      </p>
      {loggedIn === false && (
        <a href="/login" className="btn-primary mt-8 inline-flex">
          Log in with X or Discord
        </a>
      )}
      {loggedIn === true && (
        <a href="#campaigns" className="btn-primary mt-8 inline-flex">
          Continue to campaigns
        </a>
      )}
    </section>
  );
}
