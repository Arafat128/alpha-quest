import { ethers } from "ethers";
import { PrimusPageCoreTLS } from "@primuslabs/zktls-page-core-sdk";
import { encodeAttestation } from "@primuslabs/zktls-page-core-sdk/dist/utils";
import { xHandleFromRequestUrl, xProfileUserIdFromUrl } from "./task-config";
export { defaultTemplateForTask } from "./task-config";

// page-core-sdk 0.2.1 only trusts the first address. Current Primus production
// proofs are signed by the second. Development proofs use the third.
const PRIMUS_ATTESTORS = new Set([
  "0xdb736b13e2f522dbe18b2015d0291e4b193d8ef6",
  "0x5ed3176045f68617b0958a61ac1868875c98c14d",
  "0xe02bd7a6c8aa401189aebb5bad755c2610940a73",
]);

export function primusSignatureOk(attestation: {
  signatures?: unknown;
  request?: unknown;
  reponseResolve?: unknown;
  recipient?: unknown;
  data?: unknown;
  attConditions?: unknown;
  timestamp?: unknown;
  additionParams?: unknown;
}): boolean {
  const signatures = Array.isArray(attestation.signatures) ? attestation.signatures : [];
  const hash = encodeAttestation(attestation);
  for (const signature of signatures) {
    if (typeof signature !== "string" || !signature) continue;
    try {
      const recovered = ethers.utils.recoverAddress(hash, signature).toLowerCase();
      if (PRIMUS_ATTESTORS.has(recovered)) return true;
    } catch {
      // try the next signature
    }
  }
  return false;
}

let signer: PrimusPageCoreTLS | null = null;

export async function getPrimusSigner() {
  const appId = process.env.PRIMUS_APP_ID || process.env.NEXT_PUBLIC_PRIMUS_APP_ID;
  const appSecret = process.env.PRIMUS_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("PRIMUS_APP_ID and PRIMUS_APP_SECRET must be set on the server");
  }
  if (!signer) {
    signer = new PrimusPageCoreTLS();
    await signer.init(appId, appSecret);
  }
  return signer;
}

export function decodeJsonish(value: unknown): unknown {
  let cur: unknown = value;
  for (let i = 0; i < 4; i++) {
    if (typeof cur !== "string") return cur;
    const text = cur.trim();
    if (!text || (text[0] !== "{" && text[0] !== "[")) return cur;
    try {
      cur = JSON.parse(text);
    } catch {
      return cur;
    }
  }
  return cur;
}

export function flattenAttestationData(attestation: Record<string, unknown>) {
  const data = decodeJsonish(attestation.data);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {} as Record<string, unknown>;
}

export function fieldLooksTrue(data: Record<string, unknown>, field: string) {
  const want = field.toLowerCase();
  for (const [key, raw] of Object.entries(data)) {
    const name = key.toLowerCase();
    if (name === want || name.endsWith(`.${want}`)) {
      if (raw === true || raw === 1 || String(raw).toLowerCase() === "true") return true;
    }
  }
  return walkTrue(data, want);
}

function walkTrue(obj: unknown, leaf: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (Array.isArray(obj)) return obj.some((item) => walkTrue(item, leaf));
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const name = key.toLowerCase().split(".").pop() || "";
    if (name === leaf) {
      if (value === true || String(value).toLowerCase() === "true") return true;
    }
    if (walkTrue(value, leaf)) return true;
  }
  return false;
}

const FOLLOW_IGNORE = new Set([
  "followed_by",
  "super_following",
  "super_followed_by",
  "following_count",
  "followers_count",
  "friends_count",
  "follow_request_sent",
]);
const FOLLOW_LEAVES = new Set(["following", "is_following", "isfollowing", "viewer_following"]);

function coerceFollowBool(value: unknown): boolean | null {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "number" && value > 1) return null;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "following") return true;
    if (t === "false" || t === "no" || t === "follow") return false;
  }
  return null;
}

/** Viewer-follows-profile flag. null = Hub only returned screen_name / a count. */
export function followFlagFromProof(...blobs: unknown[]): boolean | null {
  let sawTrue = false;
  let sawFalse = false;
  function walk(node: unknown, path: string) {
    if (node == null) return;
    if (typeof node === "string") {
      const s = node.trim();
      if (s.startsWith("{") || s.startsWith("[")) {
        try {
          walk(JSON.parse(s), path);
        } catch {
          return;
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const leaf = key.toLowerCase().split(".").pop() || "";
      const child = path ? `${path}.${key}` : key;
      const lowPath = child.toLowerCase();
      if (FOLLOW_IGNORE.has(leaf) || leaf.endsWith("count") || lowPath.includes("relationship_counts")) {
        walk(value, child);
        continue;
      }
      if (FOLLOW_LEAVES.has(leaf) || (lowPath.includes("relationship_perspectives") && leaf === "following")) {
        const flag = coerceFollowBool(value);
        if (flag === true) sawTrue = true;
        if (flag === false) sawFalse = true;
      }
      walk(value, child);
    }
  }
  for (const blob of blobs) walk(blob, "");
  if (sawTrue) return true;
  if (sawFalse) return false;
  return null;
}

export function extractIdentity(
  data: Record<string, unknown>,
  platform: "x" | "discord"
): string | null {
  const keys =
    platform === "x"
      ? ["screen_name", "rest_id", "user_id", "id_str", "id"]
      : ["id", "user_id", "username"];
  for (const key of keys) {
    const hit = findString(data, key);
    if (hit) return hit;
  }
  return null;
}

const POSTER_SKIP_KEYS = new Set(["user_mentions", "mentions"]);

function attestationRequestUrl(attestation?: Record<string, unknown>): string | null {
  if (!attestation) return null;
  const request = attestation.request as { url?: string } | undefined;
  const nested = (attestation.attRequest as { request?: { url?: string } } | undefined)?.request;
  return request?.url || nested?.url || null;
}

function scoreOwnerPath(path: string): number {
  const lower = path.toLowerCase();
  if (lower.includes("user_mention")) return -1;
  const inTimeline = lower.includes("timeline") || lower.includes("entries") || lower.includes("tweet");
  if (!inTimeline && (lower.endsWith("core.screen_name") || lower.endsWith("legacy.screen_name") || lower.endsWith(".rest_id"))) {
    return 100;
  }
  if (!inTimeline) return 80;
  if (lower.includes("user_results")) return 40;
  return 10;
}

function collectLeaf(
  obj: unknown,
  leaf: string,
  path: string,
  out: { path: string; value: string }[]
) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => collectLeaf(item, leaf, `${path}[${index}]`, out));
    return;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (POSTER_SKIP_KEYS.has(key.toLowerCase())) continue;
    const child = path ? `${path}.${key}` : key;
    if (key.toLowerCase().split(".").pop() === leaf && typeof value === "string" && value) {
      out.push({ path: child, value });
    }
    collectLeaf(value, leaf, child, out);
  }
}

/**
 * Who the mention proof belongs to. Prefer the timeline owner's id from the
 * witnessed request. Never use a screen name that only appears as a mention.
 */
export function extractXPosterIdentity(
  data: Record<string, unknown>,
  attestation: Record<string, unknown> | undefined,
  ignoreHandles: Array<string | null | undefined>
): string | null {
  const profileId = xProfileUserIdFromUrl(attestationRequestUrl(attestation));
  if (profileId) return profileId;

  const ignore = new Set(
    ignoreHandles
      .map((value) => (value || "").replace(/^@/, "").trim().toLowerCase())
      .filter(Boolean)
  );
  const names = [] as { path: string; value: string }[];
  collectLeaf(data, "screen_name", "", names);
  const ranked = names
    .map((item) => ({ ...item, score: scoreOwnerPath(item.path) }))
    .filter((item) => item.score >= 0 && !ignore.has(item.value.replace(/^@/, "").trim().toLowerCase()))
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  if (ranked[0]) return ranked[0].value.replace(/^@/, "").trim();

  const restIds = [] as { path: string; value: string }[];
  collectLeaf(data, "rest_id", "", restIds);
  const ownerRest = restIds
    .map((item) => ({ ...item, score: scoreOwnerPath(item.path) }))
    .filter((item) => item.score >= 80 && /^\d+$/.test(item.value))
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)[0];
  return ownerRest?.value || null;
}

export function extractAttestedXHandle(
  data: Record<string, unknown>,
  attestation?: Record<string, unknown>
): string | null {
  const fromData = findString(data, "screen_name");
  if (fromData) return fromData.replace(/^@/, "").trim();
  const request = attestation?.request as { url?: string } | undefined;
  const nested = (attestation?.attRequest as { request?: { url?: string } } | undefined)?.request;
  const url = request?.url || nested?.url;
  return xHandleFromRequestUrl(url || null);
}

function findString(obj: unknown, leaf: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findString(item, leaf);
      if (found) return found;
    }
    return null;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key.toLowerCase().split(".").pop() === leaf && typeof value === "string" && value) {
      return value;
    }
    const nested = findString(value, leaf);
    if (nested) return nested;
  }
  return null;
}

export function parseAdditionParams(attestation: Record<string, unknown>) {
  const raw =
    attestation.additionParams ??
    (attestation.attRequest as Record<string, unknown> | undefined)?.additionParams;
  const decoded = decodeJsonish(raw);
  if (decoded && typeof decoded === "object") return decoded as Record<string, string>;
  return {};
}
