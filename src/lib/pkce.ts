import { createHash, randomBytes } from "crypto";

export function randomUrl(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pkcePair() {
  const verifier = randomUrl(32);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
