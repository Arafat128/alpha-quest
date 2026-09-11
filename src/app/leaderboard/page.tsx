"use client";

import { useEffect, useState } from "react";

type Row = {
  rank: number;
  userId: string;
  displayName: string;
  walletAddress: string;
  xHandle: string | null;
  points: number;
  tasks: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((j) => setRows(j.rows || []));
  }, []);

  return (
    <div>
      <h1 className="display text-5xl">Leaderboard</h1>
      <p className="mt-3 text-slate-400">Points from verified completions only.</p>
      <div className="glass mt-8 overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-4">Rank</th>
              <th className="px-6 py-4">Player</th>
              <th className="px-6 py-4">X</th>
              <th className="px-6 py-4">Tasks</th>
              <th className="px-6 py-4">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-t border-white/5">
                <td className="px-6 py-4 text-sky-200">{row.rank}</td>
                <td className="px-6 py-4">{row.displayName}</td>
                <td className="px-6 py-4">{row.xHandle ? `@${row.xHandle}` : "—"}</td>
                <td className="px-6 py-4">{row.tasks}</td>
                <td className="px-6 py-4 font-semibold">{row.points}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-6 py-10 text-slate-500" colSpan={5}>
                  No completions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
