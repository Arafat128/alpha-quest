const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const key = s.slice(0, i).trim();
    const val = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const FOLLOW_TEMPLATE =
  process.env.PRIMUS_TEMPLATE_X_FOLLOW &&
  process.env.PRIMUS_TEMPLATE_X_FOLLOW !== "771b3096-cccb-4c6f-bca8-86497ece202b"
    ? process.env.PRIMUS_TEMPLATE_X_FOLLOW
    : "674142ce-d852-4c1d-9ca3-3061ace98988";

const REQUEST_PATTERN = "https://x.com/i/api/graphql/.*/UserByScreenName\\?.*";
const RESOLVES = [
  { keyName: "screen_name", parsePath: "$.data.user.result.core.screen_name" },
  { keyName: "following", parsePath: "$.data.user.result.relationship_counts.following" },
];

const p = new PrismaClient();

async function main() {
  const tasks = await p.task.findMany({ where: { type: "X_FOLLOW" } });
  for (const task of tasks) {
    let cfg = {};
    try {
      cfg = JSON.parse(task.config || "{}");
    } catch {
      cfg = {};
    }
    cfg.request = Object.assign({ method: "GET", header: {}, body: "" }, cfg.request || {}, {
      url: REQUEST_PATTERN,
    });
    cfg.responseResolves = RESOLVES;
    await p.task.update({
      where: { id: task.id },
      data: {
        primusTemplateId: FOLLOW_TEMPLATE,
        config: JSON.stringify(cfg),
      },
    });
    console.log("updated", task.id, cfg.handle || "", FOLLOW_TEMPLATE.slice(0, 8));
  }
  console.log("count", tasks.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
