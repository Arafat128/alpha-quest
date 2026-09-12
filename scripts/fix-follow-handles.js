const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

function followConfig(screen) {
  return {
    handle: screen,
    requiredField: "following",
    request: {
      url:
        "https://x.com/i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName?variables=" +
        encodeURIComponent(JSON.stringify({ screen_name: screen, withGrokTranslatedBio: false })),
      method: "GET",
      header: {},
      body: "",
    },
    responseResolves: [
      { keyName: "screen_name", parsePath: "$.data.user.result.core.screen_name" },
      { keyName: "following", parsePath: "$.data.user.result.relationship_perspectives.following" },
    ],
  };
}

async function main() {
  const tasks = await p.task.findMany({ where: { type: "X_FOLLOW" } });
  for (const task of tasks) {
    let cfg = {};
    try {
      cfg = JSON.parse(task.config || "{}");
    } catch {
      cfg = {};
    }
    const fromTitle = (task.title.match(/@([A-Za-z0-9_]+)/) || task.title.match(/\b([A-Za-z0-9_]{3,})\b/)) || [];
    let handle = (cfg.handle || "").replace(/^@/, "");
    const titleHint = (task.title.match(/@([A-Za-z0-9_]+)/) || [])[1];
    if (titleHint && titleHint.toLowerCase() !== "example_owner") handle = titleHint;
    if (/sample/i.test(task.title) && handle.toLowerCase() === "example_owner") {
      handle = "example_user";
    }
    if (!handle) continue;
    const next = followConfig(handle);
    const clearTemplate = handle.toLowerCase() !== "example_owner";
    await p.task.update({
      where: { id: task.id },
      data: {
        config: JSON.stringify(next),
        primusTemplateId: clearTemplate ? null : task.primusTemplateId,
      },
    });
    console.log("updated", task.id, "handle=", handle, "template=", clearTemplate ? "cleared" : "kept");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
