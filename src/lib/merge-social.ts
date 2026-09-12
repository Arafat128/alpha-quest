import { prisma } from "./prisma";

export class SocialTakenError extends Error {
  constructor() {
    super("social_taken");
    this.name = "SocialTakenError";
  }
}

export async function attachDiscord(currentId: string, discordId: string, discordUsername: string | null) {
  const current = await prisma.user.findUnique({ where: { id: currentId } });
  if (!current) throw new Error("user missing");
  if (current.discordId === discordId) {
    await prisma.user.update({
      where: { id: currentId },
      data: { discordUsername: discordUsername || current.discordUsername },
    });
    return;
  }

  const taken = await prisma.user.findFirst({
    where: { discordId, NOT: { id: currentId } },
  });
  if (taken) {
    if (taken.xUserId && current.xUserId && taken.xUserId !== current.xUserId) {
      throw new SocialTakenError();
    }
    await prisma.user.update({
      where: { id: taken.id },
      data: { discordId: null, discordUsername: null },
    });
  }

  await prisma.user.update({
    where: { id: currentId },
    data: { discordId, discordUsername },
  });
}

export async function attachX(currentId: string, xUserId: string, xHandle: string | null) {
  const current = await prisma.user.findUnique({ where: { id: currentId } });
  if (!current) throw new Error("user missing");
  if (current.xUserId === xUserId) {
    await prisma.user.update({
      where: { id: currentId },
      data: { xHandle: xHandle || current.xHandle },
    });
    return;
  }

  const taken = await prisma.user.findFirst({
    where: { xUserId, NOT: { id: currentId } },
  });
  if (taken) {
    if (taken.discordId && current.discordId && taken.discordId !== current.discordId) {
      throw new SocialTakenError();
    }
    await prisma.user.update({
      where: { id: taken.id },
      data: { xUserId: null, xHandle: null },
    });
  }

  await prisma.user.update({
    where: { id: currentId },
    data: { xUserId, xHandle },
  });
}
