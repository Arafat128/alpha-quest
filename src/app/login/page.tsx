"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginInner() {
  const params = useSearchParams();
  const error = params.get("error");
  const [already, setAlready] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.user) {
          setAlready(true);
          window.location.replace("/");
        }
      })
      .catch(() => {});
  }, []);
  const messages: Record<string, string> = {
    x_not_configured: "X login is not available yet. Use Discord, or try again later.",
    discord_not_configured: "Discord login is not available yet. Try again later.",
    x_denied: "X login was cancelled.",
    x_failed: "X login failed.",
    discord_denied: "Discord login was cancelled.",
    discord_failed: "Discord login failed.",
  };

  return (
    <div className="auth-card">
      <p className="kicker">Alpha Quest</p>
      <h1 className="display page-title">{already ? "Already signed in" : "Log in"}</h1>
      <p className="hero-copy">
        No wallet required. Sign in with X or Discord. Task proofs still use Primus zkTLS against
        your live session.
      </p>
      {error && <p className="note">{messages[error] || error}</p>}
      <div className="login-actions">
        <a className="btn-primary" data-testid="login-x" href="/api/auth/x">
          Continue with X
        </a>
        <a className="btn-ghost" data-testid="login-discord" href="/api/auth/discord">
          Continue with Discord
        </a>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <LoginInner />
    </Suspense>
  );
}
