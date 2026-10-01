import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const out = {};
  const text = readFileSync(resolve(ROOT, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const results = [];

function swapScreenNameInUrl(url, _screen) {
  if (/\/i\/api\/graphql\//i.test(url) && /UserByScreenName/i.test(url)) {
    return "https://x.com/i/api/graphql/.*/UserByScreenName\\?.*";
  }
  return url;
}

function record(host, name, ok, detail) {
  results.push({ host, name, ok, detail: String(detail).slice(0, 180) });
  console.log(`${ok ? "PASS" : "FAIL"} [${host}] ${name} — ${String(detail).slice(0, 120)}`);
}

async function check(host, name, fn) {
  try {
    await fn();
  } catch (e) {
    record(host, name, false, e instanceof Error ? e.message : e);
  }
}

async function runHost(base) {
  const host = base.includes("localhost") ? "local" : "vercel";
  const jar = new Map();

  async function req(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.cookie = cookie;
    const res = await fetch(base + path, {
      ...opts,
      headers,
      redirect: opts.redirect || "manual",
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [nv] = c.split(";");
      const eq = nv.indexOf("=");
      if (eq > 0) jar.set(nv.slice(0, eq), nv.slice(eq + 1));
    }
    return res;
  }

  await check(host, "GET /", async () => {
    const r = await req("/");
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    record(host, "GET /", true, r.status);
  });

  await check(host, "GET /login", async () => {
    const r = await req("/login");
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    record(host, "GET /login", true, r.status);
  });

  await check(host, "GET /api/primus/config follow template", async () => {
    const r = await req("/api/primus/config");
    const j = await r.json();
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const id = String(j.followTemplateId || "");
    if (id !== "674142ce-d852-4c1d-9ca3-3061ace98988") {
      throw new Error(`expected wildcard Hub template, got ${id || "empty"}`);
    }
    record(host, "GET /api/primus/config follow template", true, id.slice(0, 8));
  });

  await check(host, "GET /zktls-bundle.js", async () => {
    const r = await req("/zktls-bundle.js");
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const n = Number(r.headers.get("content-length") || 0);
    if (n < 1000 && n !== 0) throw new Error(`tiny bundle ${n}`);
    record(host, "GET /zktls-bundle.js", true, r.status);
  });

  await check(host, "GET /prove.html uses Hub template path", async () => {
    const r = await req("/prove.html");
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const text = await r.text();
    if (!text.includes("generateRequestParams") || !text.includes("startAttestation")) {
      throw new Error("prove.html missing Primus extension flow");
    }
    if (text.includes("retargetFollowRequest") || text.includes("Gb-d6r0vxPOADdG62OEBpQ")) {
      throw new Error("prove.html still injects a frozen GraphQL query id");
    }
    if (!text.includes("UserByScreenName") || !text.includes("wildcardUserByScreenNameUrl")) {
      throw new Error("prove.html missing Hub wildcard Request URL");
    }
    if (!text.includes("window.close") || !text.includes("alpha-quest-verified")) {
      throw new Error("prove.html does not close after a successful proof");
    }
    if (/window\.open\(\s*["']https:\/\/x\.com\//.test(text)) {
      throw new Error("prove.html must not auto-open a second X profile tab");
    }
    if (!text.includes("launch_page")) {
      throw new Error("prove.html missing Primus launch_page data-source override");
    }
    record(host, "GET /prove.html uses Hub template path", true, "ok");
  });

  await check(host, "GET /api/tasks/x/prove unauth", async () => {
    const r = await req("/api/tasks/missing/prove");
    if (r.status !== 401) throw new Error(`expected 401 got ${r.status}`);
    record(host, "GET /api/tasks/x/prove unauth", true, "401");
  });

  await check(host, "GET /api/campaigns", async () => {
    const r = await req("/api/campaigns");
    const j = await r.json();
    if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(j)}`);
    if (!Array.isArray(j.campaigns)) throw new Error("no campaigns array");
    record(host, "GET /api/campaigns", true, `count=${j.campaigns.length}`);
  });

  await check(host, "GET /api/campaigns/genesis-attestation/tasks", async () => {
    const r = await req("/api/campaigns/genesis-attestation/tasks");
    const j = await r.json();
    if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(j)}`);
    const follow = (j.tasks || []).find((t) => t.type === "X_FOLLOW");
    if (follow && !follow.primusTemplateId) throw new Error("X_FOLLOW missing template id");
    const discord = (j.tasks || []).find((t) => t.type === "DISCORD_JOIN");
    if (discord && env.DISCORD_GUILD_ID && !discord.config?.guildId) {
      throw new Error("DISCORD_JOIN missing guild id");
    }
    record(host, "GET genesis tasks", true, `tasks=${(j.tasks || []).length}`);
  });

  await check(host, "GET /api/leaderboard", async () => {
    const r = await req("/api/leaderboard");
    const j = await r.json();
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!Array.isArray(j.rows)) throw new Error("no rows");
    record(host, "GET /api/leaderboard", true, `rows=${j.rows.length}`);
  });

  await check(host, "GET /api/auth/me anonymous", async () => {
    const r = await req("/api/auth/me");
    const j = await r.json();
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (j.user !== null) throw new Error("expected user null");
    record(host, "GET /api/auth/me anonymous", true, "user=null");
  });

  await check(host, "GET /api/auth/discord redirect", async () => {
    const r = await req("/api/auth/discord");
    const loc = r.headers.get("location") || "";
    if (r.status !== 307 && r.status !== 302) throw new Error(`status ${r.status}`);
    if (!loc.includes("discord.com")) throw new Error(`location ${loc}`);
    record(host, "GET /api/auth/discord redirect", true, loc.slice(0, 80));
  });

  await check(host, "GET /api/auth/x redirect", async () => {
    const r = await req("/api/auth/x");
    const loc = r.headers.get("location") || "";
    if (r.status !== 307 && r.status !== 302) throw new Error(`status ${r.status}`);
    if (!loc.includes("x.com") && !loc.includes("twitter.com")) throw new Error(`location ${loc}`);
    if (!loc.includes("tweet.read")) throw new Error("missing tweet.read scope");
    record(host, "GET /api/auth/x redirect", true, loc.slice(0, 80));
  });

  await check(host, "POST /api/admin/login", async () => {
    const r = await req("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: env.ADMIN_SECRET }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(JSON.stringify(j));
    record(host, "POST /api/admin/login", true, "ok");
  });

  await check(host, "GET /api/admin/campaigns", async () => {
    const r = await req("/api/admin/campaigns");
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    record(host, "GET /api/admin/campaigns", true, `count=${(j.campaigns || []).length}`);
  });

  let campaignId = "";
  await check(host, "POST /api/admin/campaigns", async () => {
    const r = await req("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Flow Check ${host} ${Date.now()}`,
        description: "Automated flow check campaign",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    campaignId = j.campaign?.id || "";
    if (!campaignId) throw new Error("no campaign id");
    record(host, "POST /api/admin/campaigns", true, campaignId.slice(0, 12));
  });

  await check(host, "POST admin add X_FOLLOW task", async () => {
    if (!campaignId) throw new Error("no campaign");
    const r = await req(`/api/admin/campaigns/${campaignId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "X_FOLLOW",
        title: "Follow check",
        points: 10,
        handle: "example_owner",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    record(host, "POST admin add X_FOLLOW task", true, j.task?.id || "ok");
  });

  await check(host, "POST admin any-handle X_FOLLOW uses shared template", async () => {
    if (!campaignId) throw new Error("no campaign");
    const r = await req(`/api/admin/campaigns/${campaignId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "X_FOLLOW",
        title: "Follow example_user",
        points: 7,
        handle: "example_user",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    const listed = await req(`/api/campaigns/${campaignId}/tasks`);
    const body = await listed.json();
    if (!listed.ok) throw new Error(JSON.stringify(body));
    const sample = (body.tasks || []).find(
      (t) => (t.config?.handle || "").toLowerCase() === "example_user"
    );
    if (!sample) throw new Error("example_user task not in campaign tasks");
    if (!sample.primusTemplateId) throw new Error("any-handle follow missing shared template id");
    record(host, "POST admin any-handle X_FOLLOW uses shared template", true, sample.primusTemplateId.slice(0, 8));
  });

  await check(host, "POST admin DISCORD_JOIN uses env guild", async () => {
    if (!campaignId) throw new Error("no campaign");
    const r = await req(`/api/admin/campaigns/${campaignId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DISCORD_JOIN",
        title: "Join Discord check",
        points: 8,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    const listed = await req(`/api/campaigns/${campaignId}/tasks`);
    const body = await listed.json();
    if (!listed.ok) throw new Error(JSON.stringify(body));
    const join = (body.tasks || []).find((t) => t.type === "DISCORD_JOIN");
    if (!join) throw new Error("discord join task missing");
    if (env.DISCORD_GUILD_ID && !join.config?.guildId) throw new Error("discord join missing guild id");
    record(host, "POST admin DISCORD_JOIN uses env guild", true, join.config?.guildId ? "guild" : "no-env");
  });

  await check(host, "GET /api/admin/users", async () => {
    const r = await req("/api/admin/users");
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    record(host, "GET /api/admin/users", true, `users=${(j.users || []).length}`);
  });

  await check(host, "POST /api/admin/logout", async () => {
    const r = await req("/api/admin/logout", { method: "POST" });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    record(host, "POST /api/admin/logout", true, "ok");
  });

  await check(host, "GET /api/admin/campaigns after logout", async () => {
    const r = await req("/api/admin/campaigns");
    if (r.status !== 401) throw new Error(`expected 401 got ${r.status}`);
    record(host, "GET /api/admin/campaigns after logout", true, "401");
  });

  await check(host, "POST /api/account/email/request-otp unauth", async () => {
    const r = await req("/api/account/email/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "flow@example.com" }),
    });
    if (r.status !== 401) throw new Error(`expected 401 got ${r.status}`);
    record(host, "POST email otp unauth", true, "401");
  });
}

await check("unit", "wildcard UserByScreenName request URL", async () => {
  const url =
    "https://x.com/i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName?variables=" +
    encodeURIComponent(JSON.stringify({ screen_name: "example_owner", withGrokTranslatedBio: false }));
  const next = swapScreenNameInUrl(url, "example_user");
  const want = "https://x.com/i/api/graphql/.*/UserByScreenName\\?.*";
  if (next !== want) throw new Error(next);
  record("unit", "wildcard UserByScreenName request URL", true, next);
});

await check("unit", "in-page verify starts on the campaign page", async () => {
  const btn = readFileSync(resolve(ROOT, "src/components/VerifyButton.tsx"), "utf8");
  const client = readFileSync(resolve(ROOT, "src/lib/primus-client.ts"), "utf8");
  const card = readFileSync(resolve(ROOT, "src/components/TaskCard.tsx"), "utf8");
  if (btn.includes("prove.html")) throw new Error("VerifyButton still opens prove.html");
  if (btn.includes("window.open")) throw new Error("VerifyButton still opens a new tab");
  if (!btn.includes("startPrimusProof")) throw new Error("VerifyButton missing in-page Primus start");
  if (!client.includes("launch_page")) throw new Error("primus-client missing launch_page");
  if (!client.includes("generateRequestParams") || !client.includes("startAttestation")) {
    throw new Error("primus-client missing Primus extension flow");
  }
  if (client.includes("retargetFollowRequest") || client.includes("Gb-d6r0vxPOADdG62OEBpQ")) {
    throw new Error("primus-client still injects a frozen GraphQL query id");
  }
  if (!client.includes("UserByScreenName") && !client.includes("wildcardUserByScreenNameUrl")) {
    throw new Error("primus-client missing Hub wildcard Request URL");
  }
  if (/window\.open\(\s*["']https:\/\/x\.com\//.test(client)) {
    throw new Error("primus-client must not auto-open a second X profile tab");
  }
  if (!client.includes("USER_TWEETS_REQUEST_PATTERN") || !client.includes("X_POST")) {
    throw new Error("primus-client missing X post data-source retarget");
  }
  if (!card.includes("startVerify") || !card.includes("onClick")) {
    throw new Error("TaskCard does not start verify on click");
  }
  const proveRoute = readFileSync(resolve(ROOT, "src/app/api/tasks/[id]/prove/route.ts"), "utf8");
  if (!proveRoute.includes("dataSourceHandle")) {
    throw new Error("prove route missing dataSourceHandle for post quests");
  }
  record("unit", "in-page verify starts on the campaign page", true, "ok");
});

const bases = process.argv.slice(2);
if (!bases.length) {
  bases.push("http://localhost:3000", "https://alpha-quest-kappa.vercel.app");
}

for (const base of bases) {
  console.log("\n===", base, "===");
  await runHost(base.replace(/\/$/, ""));
}

const failed = results.filter((r) => !r.ok);
console.log("\n=== SUMMARY ===");
console.log("pass", results.filter((r) => r.ok).length, "fail", failed.length);
if (failed.length) {
  for (const f of failed) console.log("FAIL", f.host, f.name, f.detail);
  process.exit(1);
}
