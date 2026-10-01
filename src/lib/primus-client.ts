import { normalizeXHandle, wildcardUserByScreenNameUrl } from "./task-config";

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

function retargetDataSourceUrl(url: string, handle: string) {
  if (/\/i\/api\/graphql\//i.test(url) || /UserByScreenName/i.test(url)) {
    return wildcardUserByScreenNameUrl(url);
  }
  if (!handle) return url;
  const match = url.match(
    /^(https:\/\/(?:www\.)?(?:x|twitter)\.com\/)(?!i\/)([A-Za-z0-9_]+)\/?(\?.*)?$/i
  );
  if (!match) return url;
  return match[1] + handle + (match[3] || "");
}

function applyWildcardRequestUrl(target: unknown, handle: string) {
  if (!target || typeof target !== "object") return;
  const rec = target as JsonRecord;
  if (rec.request && typeof rec.request === "object") {
    const req = rec.request as JsonRecord;
    if (typeof req.url === "string") req.url = retargetDataSourceUrl(req.url, handle);
  }
  if (typeof rec.url === "string") rec.url = retargetDataSourceUrl(rec.url, handle);
  if (typeof rec.backUrl === "string") rec.backUrl = retargetDataSourceUrl(rec.backUrl, handle);
}

export function friendlyPrimusError(err: unknown) {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code || "") : "";
  const blob = `${code} ${msg}`.toLowerCase();
  if (blob.includes("00013") || blob.includes("no verifiable data")) {
    return "Primus could not read X. Stay logged into X in this same Chrome profile, follow the account if you have not, keep the orange popup in front, then try again.";
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
  user: PrimusUser;
  onStatus?: (msg: string) => void;
}) {
  const { taskId, user, onStatus } = opts;
  let handle = normalizeXHandle(opts.handle);
  let templateId = (opts.templateId || "").trim();

  onStatus?.("Starting proof on this page…");

  const [proveRes, primusCfg] = await Promise.all([
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/prove`, { credentials: "include" }),
    fetch("/api/primus/config", { credentials: "include" }).then((r) => r.json() as Promise<{ appId?: string; followTemplateId?: string }>),
  ]);
  const proveCfg = (await proveRes.json()) as {
    error?: string;
    handle?: string;
    templateId?: string;
    boundAddress?: string;
  };
  if (!proveRes.ok) throw new Error(proveCfg.error || "Could not load this quest");
  if (proveCfg.handle) handle = normalizeXHandle(proveCfg.handle);
  if (proveCfg.templateId) templateId = proveCfg.templateId;
  if (!templateId) templateId = primusCfg.followTemplateId || "";
  if (!templateId) throw new Error("This quest has no Primus Hub template.");
  if (!primusCfg.appId) throw new Error("Primus app is not configured");

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
  const extra: JsonRecord = { taskId, userId: user.id, handle };
  if (handle) extra.launch_page = `https://x.com/${handle}`;
  request.setAdditionParams(JSON.stringify(extra));
  if (typeof request.setAllJsonResponseFlag === "function") {
    request.setAllJsonResponseFlag("true");
  } else {
    request.allJsonResponseFlag = "true";
  }
  applyWildcardRequestUrl(request, handle);
  applyWildcardRequestUrl(request.request, handle);

  let unsigned = request.toJsonString();
  try {
    const parsed = JSON.parse(unsigned) as JsonRecord;
    applyWildcardRequestUrl(parsed, handle);
    applyWildcardRequestUrl(parsed.request, handle);
    applyWildcardRequestUrl(parsed.attRequest, handle);
    if (parsed.attRequest) applyWildcardRequestUrl((parsed.attRequest as JsonRecord).request, handle);
    unsigned = JSON.stringify(parsed);
  } catch {
    // keep unsigned as toJsonString()
  }

  onStatus?.(
    handle
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
