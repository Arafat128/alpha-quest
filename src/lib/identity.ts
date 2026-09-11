import { sha256 } from "./hash";

/** Primus still wants an address; without a wallet we bind a deterministic placeholder. */
export function boundAddress(userId: string, wallet?: string | null): `0x${string}` {
  if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return wallet.toLowerCase() as `0x${string}`;
  }
  return (`0x${sha256(`alpha-quest:${userId}`).slice(0, 40)}`) as `0x${string}`;
}

export function displayName(user: {
  xHandle?: string | null;
  discordUsername?: string | null;
  email?: string | null;
  walletAddress?: string | null;
  id: string;
}) {
  if (user.xHandle) return `@${user.xHandle}`;
  if (user.discordUsername) return user.discordUsername;
  if (user.email) return user.email;
  if (user.walletAddress) return `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`;
  return user.id.slice(0, 8);
}
