import { PrimusPageCoreTLS } from "@primuslabs/zktls-page-core-sdk";
import { xHandleFromRequestUrl } from "./task-config";
export { defaultTemplateForTask } from "./task-config";

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
