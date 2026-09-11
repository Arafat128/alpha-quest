import { createHash } from "crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashAttestation(attestation: unknown): string {
  return sha256(JSON.stringify(attestation));
}

export function provenIdentityHash(platform: string, identity: string): string {
  return sha256(`${platform}:${identity.trim().toLowerCase()}`);
}
