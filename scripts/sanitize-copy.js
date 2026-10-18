const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  await p.campaign.updateMany({
    data: {
      description:
        "Complete real social actions. Follows and posts are proven with zkTLS — not a checkbox.",
    },
  });
  await p.task.updateMany({
    where: { type: "X_FOLLOW" },
    data: {
      description: "Follow @example_owner on X. We verify the follow from your live X session.",
    },
  });
  await p.task.updateMany({
    where: { type: "X_POST" },
    data: {
      description: "Post about the campaign on X. We verify a recent post from your session.",
    },
  });
  await p.task.updateMany({
    where: { type: "DISCORD_JOIN" },
    data: {
      description: "Join the campaign Discord. Membership is checked against the official server.",
    },
  });
  console.log("copy updated");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
