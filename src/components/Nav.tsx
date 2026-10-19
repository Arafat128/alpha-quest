"use client";

import Link from "next/link";

export default function Nav() {
  return (
    <header className="site-nav">
      <Link href="/" className="brand">
        <span className="mark">AQ</span>
        Alpha Quest
      </Link>
      <nav className="nav-links">
        <Link href="/#proofs">Proofs</Link>
        <Link href="/leaderboard">Board</Link>
      </nav>
    </header>
  );
}
