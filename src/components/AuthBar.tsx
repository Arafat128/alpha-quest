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

  if (me === undefined) return <span className="px-3 text-xs text-slate-500">…</span>;

  if (!me) {
    return (
      <div className="flex items-center gap-2">
        {admin && (
          <Link href="/admin" className="hidden px-2 text-xs text-slate-400 hover:text-white sm:inline">
            Admin
          </Link>
        )}
        <Link href="/login" className="btn-primary px-4 py-2 text-xs">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {admin && (
        <Link href="/admin" className="hidden px-2 text-xs text-slate-400 hover:text-white sm:inline">
          Admin
        </Link>
      )}
      <Link
        href="/account"
        className="max-w-[9rem] truncate rounded-full bg-white/5 px-3 py-2 text-xs text-slate-200 hover:text-white"
      >
        {me.displayName}
      </Link>
      <button
        className="btn-ghost px-3 py-2 text-xs"
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
