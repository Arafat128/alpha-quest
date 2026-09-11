import { prisma } from "./prisma";

export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = new Date();
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowEnd < now) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        windowEnd: new Date(now.getTime() + windowMs),
      },
      update: {
        count: 1,
        windowEnd: new Date(now.getTime() + windowMs),
      },
    });
    return { ok: true, remaining: max - 1 };
  }
  if (row.count >= max) {
    return { ok: false, remaining: 0 };
  }
  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return { ok: true, remaining: max - row.count - 1 };
}
