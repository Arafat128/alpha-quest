/**
 * Click-through E2E for Alpha Quest (local + Vercel).
 * Usage: node scripts/e2e.mjs [url ...]
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const p = resolve("D:/grock/Primus labs/primus-quest-platform/.env");
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const outDir = resolve("D:/grock/Primus labs/primus-quest-platform/test-results");
mkdirSync(outDir, { recursive: true });

const results = [];
function log(ok, host, name, detail) {
  results.push({ ok, host, name, detail: String(detail).slice(0, 240) });
  console.log(`${ok ? "PASS" : "FAIL"} [${host}] ${name} — ${String(detail).slice(0, 140)}`);
}

async function shot(page, name) {
  const file = resolve(outDir, `${name.replace(/[^\w.-]+/g, "_")}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

const leakRe = /PRIMUS_TEMPLATE|ADMIN_SECRET|npx prisma|appSecret|parsePath|relationship_counts/;

async function runBase(browser, base) {
  const host = base.includes("localhost") ? "local" : "vercel";
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);

  try {
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const home = await page.content();
    if (leakRe.test(home)) {
      await shot(page, `${host}-home-leak`);
      log(false, host, "home no internal leaks", "found internal strings");
    } else {
      log(true, host, "home no internal leaks", "clean");
    }
    const hasAdminNav = await page.getByRole("link", { name: /^Admin$/ }).count();
    log(!hasAdminNav, host, "admin hidden until login", `count=${hasAdminNav}`);

    const genesis = page.locator('[data-testid="campaign-genesis-attestation"]');
    const genesisText = page.getByRole("heading", { name: "Genesis Attestation" });
    if (await genesis.count()) {
      await genesis.first().click();
      await page.waitForURL(/\/campaigns\//);
      const verify = page.getByTestId("verify-btn");
      await verify.first().waitFor({ state: "visible" });
      log(true, host, "open genesis + verify buttons", `n=${await verify.count()}`);
      const html = await page.content();
      log(!/PRIMUS_TEMPLATE/.test(html), host, "campaign copy public", "ok");
    } else if (await genesisText.count()) {
      await genesisText.first().click();
      await page.waitForURL(/\/campaigns\//);
      const verify = page.getByRole("button", { name: "Verify" });
      await verify.first().waitFor({ state: "visible" });
      log(true, host, "open genesis + verify buttons", `n=${await verify.count()}`);
    } else {
      log(false, host, "open genesis campaign", "card missing");
      await shot(page, `${host}-no-genesis`);
    }

    await page.goto(base + "/leaderboard", { waitUntil: "domcontentloaded" });
    log((await page.getByText("Leaderboard").count()) > 0, host, "leaderboard", page.url());

    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    log(!page.url().includes("/login"), host, "login redirects home", page.url());

    await page.goto(base + "/account", { waitUntil: "domcontentloaded" });
    log(!page.url().includes("/account"), host, "account redirects home", page.url());

    await page.goto(base + "/admin", { waitUntil: "domcontentloaded" });
    const pw = env.ADMIN_SECRET || "";
    if (!pw) throw new Error("ADMIN_SECRET missing in .env");
    const loginApi = await page.request.post(base + "/api/admin/login", {
      data: { password: pw },
    });
    if (!loginApi.ok()) throw new Error(`login API ${loginApi.status()} ${await loginApi.text()}`);
    await page.goto(base + "/admin", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "New campaign" }).waitFor({ timeout: 20000 });
    log(true, host, "admin dashboard after login", "ok");

    const box = page.getByTestId("admin-password");
    if (await box.count()) {
      await box.fill(pw);
      await page.getByTestId("admin-enter").click();
      await page.getByRole("heading", { name: "New campaign" }).waitFor({ timeout: 15000 });
      log(true, host, "admin login click", "dashboard");
    } else {
      log(true, host, "admin login click", "already in dashboard via session");
    }

    const title = `E2E ${host} ${Date.now()}`;
    await page.getByTestId("campaign-title").fill(title);
    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/campaigns") && r.request().method() === "POST"),
      page.getByTestId("create-campaign").click(),
    ]);
    if (!createRes.ok()) throw new Error(`create ${createRes.status()} ${await createRes.text()}`);
    const listed = page.locator("p.font-semibold", { hasText: title });
    const createdMsg = page.getByText(/Created /);
    await Promise.race([
      listed.waitFor({ state: "visible", timeout: 15000 }),
      createdMsg.waitFor({ state: "visible", timeout: 15000 }),
    ]);
    log(true, host, "admin create campaign click", title);

    await page.getByRole("button", { name: "Admin sign out" }).click();
    await page.getByTestId("admin-password").waitFor({ state: "visible" });
    const leftover = await page.getByTestId("admin-password").inputValue();
    log(leftover === "", host, "admin password cleared after sign out", leftover ? "still filled" : "empty");

    const health = await page.request.get(base + "/api/health");
    const hj = await health.json();
    log(health.ok() && hj.ok === true, host, "GET /api/health", JSON.stringify(hj).slice(0, 120));

    const bundle = await page.request.get(base + "/zktls-bundle.js");
    log(bundle.ok(), host, "zktls-bundle.js", bundle.status());
  } catch (e) {
    await shot(page, `${host}-crash`);
    log(false, host, "suite", e instanceof Error ? e.message : e);
  } finally {
    await page.close();
  }
}

const bases = process.argv.slice(2);
if (!bases.length) {
  bases.push("http://localhost:3000", "https://alpha-quest-kappa.vercel.app");
}

const browser = await chromium.launch({ headless: true });
for (const base of bases) {
  console.log("\n=== click", base, "===");
  await runBase(browser, base.replace(/\/$/, ""));
}
await browser.close();

const fail = results.filter((r) => !r.ok);
writeFileSync(resolve(outDir, "e2e-report.json"), JSON.stringify(results, null, 2));
console.log("\n=== SUMMARY ===");
console.log("pass", results.filter((r) => r.ok).length, "fail", fail.length);
if (fail.length) {
  for (const f of fail) console.log("FAIL", f.host, f.name, f.detail);
  process.exit(1);
}
