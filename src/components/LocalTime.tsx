"use client";

import { useEffect, useState } from "react";

export default function LocalTime({ iso, prefix }: { iso: string; prefix?: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const date = new Date(iso);
    setLabel(
      Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    );
  }, [iso]);

  if (!label) return null;
  return (
    <span>
      {prefix}
      {label}
    </span>
  );
}
