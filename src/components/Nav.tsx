"use client";

import Link from "next/link";
import AuthBar from "./AuthBar";

export default function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-black/20 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="display text-xl tracking-tight">
          Alpha Quest
        </Link>
        <nav className="flex items-center gap-6 text-sm text-slate-300">
          <Link href="/" className="hover:text-white">
            Campaigns
          </Link>
          <Link href="/leaderboard" className="hover:text-white">
            Leaderboard
          </Link>
          <Link href="/account" className="hover:text-white">
            Account
          </Link>
          <AuthBar />
        </nav>
      </div>
    </header>
  );
}
