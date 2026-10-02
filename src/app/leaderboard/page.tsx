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
      <p className="kicker">Standings</p>
      <h1 className="display page-title">Leaderboard</h1>
      <p className="hero-copy">Points from verified completions only.</p>
      <div className="board">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>X</th>
              <th>Tasks</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td className="rank">{String(row.rank).padStart(2, "0")}</td>
                <td>{row.displayName}</td>
                <td className="muted">{row.xHandle ? `@${row.xHandle}` : "—"}</td>
                <td>{row.tasks}</td>
                <td className="points">{row.points}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="muted" colSpan={5}>
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
