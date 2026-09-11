"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { displayName: string };

export default function AuthBar() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        setMe(j.user ?? null);
        setAdmin(Boolean(j.admin));
      })
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return <span className="text-xs text-slate-500">…</span>;

  if (!me) {
    return (
      <div className="flex items-center gap-3">
        {admin && (
          <Link href="/admin" className="text-xs text-slate-400 hover:text-white">
            Admin
          </Link>
        )}
        <Link href="/login" className="btn-primary text-xs">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {admin && (
        <Link href="/admin" className="text-xs text-slate-400 hover:text-white">
          Admin
        </Link>
      )}
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
