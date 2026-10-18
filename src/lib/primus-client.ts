import {
  DISCORD_MEMBER_REQUEST_PATTERN,
  discordChannelUrl,
  normalizeXHandle,
  loosenXPostPaths,
  USER_TWEETS_REQUEST_PATTERN,
  X_ACCOUNT_SETTINGS_PATTERN,
  wildcardUserByScreenNameUrl,
  wildcardXGraphqlUrl,
} from "./task-config";

type JsonRecord = Record<string, unknown>;

type PrimusRequestHandle = {
  setAttMode: (mode: { algorithmType: string }) => void;
  setAdditionParams: (json: string) => void;
  setCloseDataSourceOnProofComplete?: (value: boolean) => void;
  setAllJsonResponseFlag?: (value: string) => void;
  allJsonResponseFlag?: string;
  toJsonString: () => string;
  request?: unknown;
  url?: string;
  backUrl?: string;
};

type PrimusZk = {
  init: (appId: string) => Promise<void>;
  generateRequestParams?: (
    templateId: string,
    userAddress: string,
    opts?: { closeDataSourceOnProofComplete?: boolean }
  ) => PrimusRequestHandle;
  startAttestation: (signed: string) => Promise<unknown>;
  closeDataSourceTab?: () => void;
  getAllJsonResponse?: (requestId: string) => unknown;
  getPrivateData?: (requestId: string) => unknown;
};

declare global {
  interface Window {
    PrimusZKTLS?: new () => PrimusZk;
    VoiceSenseZKTLS?: new () => PrimusZk;
  }
}

function retargetDataSourceUrl(url: string, handle: string, taskType: string, guildId = "") {
  if (taskType === "DISCORD_JOIN" || taskType === "DISCORD_ROLE") {
    if (/discord\.com\/api\/.*\/users\/@me\/guilds/i.test(url)) return DISCORD_MEMBER_REQUEST_PATTERN;
    if (guildId && /^https:\/\/discord\.com\/channels\/\d+/i.test(url)) return discordChannelUrl(guildId);
    return url;
  }
  if (taskType === "X_POST" && /\/i\/api\/graphql\//i.test(url)) {
    if (/UserByScreenName/i.test(url) || /UserTweets/i.test(url) || /UserOriginalsTimeline/i.test(url)) {
      return USER_TWEETS_REQUEST_PATTERN;
    }
    return wildcardXGraphqlUrl(url);
  }
  if (/\/i\/api\/graphql\//i.test(url) || /UserByScreenName/i.test(url)) {
    return wildcardUserByScreenNameUrl(url);
  }
  const wild = wildcardXGraphqlUrl(url);
  if (wild !== url) return wild;
  if (!handle) return url;
  const match = url.match(
    /^(https:\/\/(?:www\.)?(?:x|twitter)\.com\/)(?!i\/)([A-Za-z0-9_]+)\/?(\?.*)?$/i
  );
  if (!match) return url;
  return match[1] + handle + (match[3] || "");
}

function applyWildcardRequestUrl(target: unknown, handle: string, taskType: string, guildId = "") {
  if (!target || typeof target !== "object") return;
  const rec = target as JsonRecord;
  if (rec.request && typeof rec.request === "object") {
    const req = rec.request as JsonRecord;
    if (typeof req.url === "string") req.url = retargetDataSourceUrl(req.url, handle, taskType, guildId);
  }
  if (typeof rec.url === "string") rec.url = retargetDataSourceUrl(rec.url, handle, taskType, guildId);
  if (typeof rec.backUrl === "string") rec.backUrl = retargetDataSourceUrl(rec.backUrl, handle, taskType, guildId);
}

function pointAtLoggedInXAccount(parsed: JsonRecord) {
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const rec = node as JsonRecord;
    if (typeof rec.url === "string" && /graphql|UserOriginalsTimeline|UserTweets|UserByScreenName/i.test(rec.url)) {
      rec.url = X_ACCOUNT_SETTINGS_PATTERN;
    }
    if (rec.responseResolves) {
      rec.responseResolves = [{ keyName: "screen_name", parsePath: "$.screen_name" }];
    }
    if (rec.request) visit(rec.request);
    if (rec.attRequest) visit(rec.attRequest);
  };
  visit(parsed);
}

function readLoggedInXHandle(attestation: unknown) {
  const record = attestation && typeof attestation === "object" ? (attestation as JsonRecord) : {};
  const raw = record.data;
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as JsonRecord) : raw;
    if (parsed && typeof parsed === "object" && "screen_name" in parsed) {
      return normalizeXHandle(String((parsed as JsonRecord).screen_name || ""));
    }
  } catch {
    // fall through to a text search
  }
  const match = JSON.stringify(attestation).match(/"screen_name"\s*:\s*"([A-Za-z0-9_]{1,15})"/);
  return match ? match[1] : "";
}

export function friendlyPrimusError(err: unknown) {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code || "") : "";
  const blob = `${code} ${msg}`.toLowerCase();
  if (blob.includes("00013") || blob.includes("no verifiable data")) {
    return "Primus could not read that X page. Stay logged into X in this Chrome profile, keep the orange popup in front, and stay on your own profile until it finishes.";
  }
  if (blob.includes("00006") || blob.includes("extension not detected")) {
    return "Install and enable the Primus Chrome extension, then try again.";
  }
  if (blob.includes("session expired") || blob.includes("30001:401")) {
    return "Your X login expired. Log into X in this Chrome profile, then try again.";
  }
  if (blob.includes("timeout") || blob.includes("interrupt") || blob.includes("timed out")) {
    return "Connection dropped before Primus finished. Keep the orange popup in front, stay on this tab, then try again.";
  }
  return msg || "Verify failed";
}

export type PrimusUser = {
  id: string;
  boundAddress?: string | null;
};

export async function startPrimusProof(opts: {
  taskId: string;
  templateId?: string | null;
  handle?: string | null;
  taskType?: string | null;
  guildId?: string | null;
  launchPage?: string | null;
  mode?: "account" | "proof";
  user: PrimusUser;
  onStatus?: (msg: string) => void;
}): Promise<void | string> {
  const { taskId, user, onStatus } = opts;
  let handle = normalizeXHandle(opts.handle);
  let templateId = (opts.templateId || "").trim();
  let taskType = (opts.taskType || "").trim();
  let guildId = (opts.guildId || "").trim();

  onStatus?.("Starting proof on this page…");

  const [proveRes, primusCfg] = await Promise.all([
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/prove`, { credentials: "include" }),
    fetch("/api/primus/config", { credentials: "include" }).then((r) => r.json() as Promise<{ appId?: string; followTemplateId?: string }>),
  ]);
  const proveCfg = (await proveRes.json()) as {
    error?: string;
    handle?: string;
    type?: string;
    guildId?: string;
    templateId?: string;
    boundAddress?: string;
  };
  if (!proveRes.ok) throw new Error(proveCfg.error || "Could not load this quest");
  if (proveCfg.type) taskType = proveCfg.type;
  if (proveCfg.handle) handle = normalizeXHandle(proveCfg.handle);
  if (proveCfg.guildId) guildId = proveCfg.guildId;
  if (proveCfg.templateId) templateId = proveCfg.templateId;
  const discordTask = taskType === "DISCORD_JOIN" || taskType === "DISCORD_ROLE";
  if (!templateId && !discordTask) templateId = primusCfg.followTemplateId || "";
  if (!templateId) throw new Error("This quest has no Primus Hub template.");
  if (!primusCfg.appId) throw new Error("Primus app is not configured");

  if (taskType === "X_POST" && !opts.launchPage) {
    onStatus?.("Checking the X account logged in to this Chrome profile…");
    const screen = await startPrimusProof({
      ...opts,
      launchPage: "https://x.com/home",
      mode: "account",
    });
    if (typeof screen !== "string" || !screen) {
      throw new Error("Log into X in this Chrome profile, then try again.");
    }
    onStatus?.(`Opening @${screen}. Stay on that profile until Primus finishes.`);
    await startPrimusProof({
      ...opts,
      handle: screen,
      launchPage: `https://x.com/${screen}`,
      mode: "proof",
    });
    return;
  }

  const Ctor = window.PrimusZKTLS || window.VoiceSenseZKTLS;
  if (typeof Ctor !== "function") {
    throw new Error("Install and enable the Primus Chrome extension, then try again.");
  }

  const zk = new Ctor();
  await zk.init(primusCfg.appId);

  const userAddress = proveCfg.boundAddress || user.boundAddress || "";
  const request =
    typeof zk.generateRequestParams === "function"
      ? zk.generateRequestParams(templateId, userAddress, { closeDataSourceOnProofComplete: true })
      : null;
  if (!request) throw new Error("Primus SDK missing generateRequestParams");
  if (typeof request.setCloseDataSourceOnProofComplete === "function") {
    request.setCloseDataSourceOnProofComplete(true);
  }
  request.setAttMode({ algorithmType: "proxytls" });

  // Primus extension uses additionParams.launch_page as chrome.tabs.create
  // URL, overriding Hub dataPageTemplate.baseUrl.
  const extra: JsonRecord = { taskId, userId: user.id, handle, guildId };
  if (opts.launchPage) extra.launch_page = opts.launchPage;
  else if (discordTask && guildId) extra.launch_page = discordChannelUrl(guildId);
  else if (taskType === "X_POST") extra.launch_page = "https://x.com/home";
  else if (handle) extra.launch_page = `https://x.com/${handle}`;
  request.setAdditionParams(JSON.stringify(extra));
  if (typeof request.setAllJsonResponseFlag === "function") {
    request.setAllJsonResponseFlag("true");
  } else {
    request.allJsonResponseFlag = "true";
  }
  applyWildcardRequestUrl(request, handle, taskType, guildId);
  applyWildcardRequestUrl(request.request, handle, taskType, guildId);

  let unsigned = request.toJsonString();
  try {
    const parsed = JSON.parse(unsigned) as JsonRecord;
    applyWildcardRequestUrl(parsed, handle, taskType, guildId);
    applyWildcardRequestUrl(parsed.request, handle, taskType, guildId);
    applyWildcardRequestUrl(parsed.attRequest, handle, taskType, guildId);
    if (parsed.attRequest) {
      applyWildcardRequestUrl((parsed.attRequest as JsonRecord).request, handle, taskType, guildId);
    }
    if (taskType === "X_POST") loosenXPostPaths(parsed);
    if (opts.mode === "account") pointAtLoggedInXAccount(parsed);
    unsigned = JSON.stringify(parsed);
  } catch {
    // keep unsigned as toJsonString()
  }

  onStatus?.(
    discordTask
      ? "Keep the orange Primus popup in front. Stay in the campaign Discord server in the tab Primus opens."
      : taskType === "X_POST" && opts.mode === "account"
        ? "Keep the orange popup in front. Stay on X until your account name is read."
        : taskType === "X_POST"
          ? "Keep the orange popup in front. Stay on your profile until Primus finishes."
        : handle
          ? `Keep the orange Primus popup in front. Stay on @${handle}'s profile in the tab Primus opens.`
          : "Keep the orange Primus popup in front until it finishes."
  );

  const signedRes = await fetch("/api/primus/sign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signParams: unsigned, taskId }),
  });
  const signedJson = (await signedRes.json()) as { error?: string; signResult?: unknown };
  if (!signedRes.ok) throw new Error(signedJson.error || "Sign failed");
  const signed =
    typeof signedJson.signResult === "string"
      ? signedJson.signResult
      : JSON.stringify(signedJson.signResult);

  let requestId: string | null = null;
  try {
    requestId = (JSON.parse(signed) as { attRequest?: { requestid?: string } }).attRequest?.requestid || null;
  } catch {
    requestId = null;
  }

  const attestation = await zk.startAttestation(signed);
  if (!attestation) throw new Error("Empty proof");

  const extras: JsonRecord = {};
  try {
    const rid =
      (attestation as { requestid?: string }).requestid || requestId;
    if (rid && typeof zk.getAllJsonResponse === "function") {
      extras.allJsonResponse = zk.getAllJsonResponse(rid);
    }
    if (rid && typeof zk.getPrivateData === "function") {
      extras.privateData = zk.getPrivateData(rid);
    }
  } catch {
    // extras are optional
  }

  if (opts.mode === "account") {
    try {
      if (typeof zk.closeDataSourceTab === "function") zk.closeDataSourceTab();
    } catch {
      // ignore
    }
    return readLoggedInXHandle(attestation);
  }

  const verifyRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attestation, extras }),
  });
  const verifyJson = (await verifyRes.json()) as { error?: string };
  if (!verifyRes.ok) throw new Error(verifyJson.error || "Quest rejected the proof");

  try {
    if (typeof zk.closeDataSourceTab === "function") zk.closeDataSourceTab();
  } catch {
    // ignore
  }
}
