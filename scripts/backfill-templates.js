const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const follow = process.env.PRIMUS_TEMPLATE_X_FOLLOW;
  if (follow) {
    await p.task.updateMany({
      where: { type: "X_FOLLOW" },
      data: { primusTemplateId: follow },
    });
  }
  const tasks = await p.task.findMany({ select: { type: true, primusTemplateId: true } });
  console.log(tasks);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
