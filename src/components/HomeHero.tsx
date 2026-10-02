"use client";

import { useEffect, useState } from "react";

export default function HomeHero({
  campaigns,
  tasks,
}: {
  campaigns: number;
  tasks: number;
}) {
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
    <section className="hero">
      <div>
        <p className="kicker">Primus zkTLS · no wallet</p>
        <h1 className="display">
          Prove the action.
          <em> Keep the session yours.</em>
        </h1>
        <p className="hero-copy">
          {loggedIn
            ? `Signed in as ${name}. Open a campaign and verify tasks — X actions still use Primus zkTLS.`
            : "Log in with X or Discord. Follows and posts are attested from your live browser session, not a checkbox."}
        </p>
        {loggedIn === false && (
          <a href="/login" className="btn-primary mt-8">
            Log in with X or Discord
          </a>
        )}
        {loggedIn === true && (
          <a href="#campaigns" className="btn-primary mt-8">
            Continue to campaigns
          </a>
        )}
      </div>
      <aside className="slip" aria-label="How a proof works">
        <div className="slip-top">
          <span>AQ-01</span>
          <span>Live session</span>
        </div>
        <p className="slip-title">Attestation</p>
        <ol>
          <li>
            <span>01</span>
            Sign in with X or Discord
          </li>
          <li>
            <span>02</span>
            Do the action in your own browser
          </li>
          <li>
            <span>03</span>
            zkTLS proves it. The session stays local
          </li>
        </ol>
        <div className="slip-foot">
          <span className="seal">
            {String(campaigns).padStart(2, "0")} campaigns · {tasks} tasks
          </span>
          <span>Primus</span>
        </div>
      </aside>
    </section>
  );
}
