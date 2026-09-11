import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  const header = req.headers.get("x-admin-secret") || "";
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cwd = process.cwd();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(cwd, "prisma", "seed.js")], {
      cwd,
      env: process.env,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed ${code}`))));
  });
  return NextResponse.json({ ok: true });
}
