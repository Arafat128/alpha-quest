"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { displayName: string; xHandle: string | null; discordUsername: string | null };

export default function AuthBar() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => setMe(j.user ?? null))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return <span className="text-xs text-slate-500">…</span>;

  if (!me) {
    return (
      <Link href="/login" className="btn-primary text-xs">
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/account" className="text-xs text-sky-200">
        {me.displayName}
      </Link>
      <button
        className="btn-ghost text-xs"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/";
        }}
      >
        Sign out
      </button>
    </div>
  );
}
