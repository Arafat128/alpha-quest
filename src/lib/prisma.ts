import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function writableDatabaseUrl() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  if (!raw.startsWith("file:")) return raw;
  if (!process.env.VERCEL) return raw;

  const dest = "/tmp/alpha-quest.db";
  const rel = raw.replace(/^file:/, "");
  const candidates = [
    path.resolve(process.cwd(), rel),
    path.join(process.cwd(), "prisma", "data.db"),
    path.join(process.cwd(), "prisma", "dev.db"),
  ];
  if (!fs.existsSync(dest)) {
    const src = candidates.find((file) => fs.existsSync(file));
    if (src) fs.copyFileSync(src, dest);
  }
  process.env.DATABASE_URL = `file:${dest}`;
  return process.env.DATABASE_URL;
}

writableDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
