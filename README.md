# Alpha Quest

Galxe-style campaigns where **X tasks are proven with Primus zkTLS**, not a checkbox. Wallet (SIWE) is the primary account. Completions hash the proven social identity so one X/Discord user cannot farm multiple wallets.

Visual: liquid glass / dark editorial. Stack: Next.js 14 App Router, TypeScript, Tailwind, Prisma + Neon Postgres, wagmi/viem, Foundry stub for v2 on-chain verify.

## Run locally

```bash
cd primus-quest-platform
cp .env.example .env
# fill PRIMUS_APP_ID / PRIMUS_APP_SECRET from https://dev.primuslabs.xyz
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

1. Log in with **X** or **Discord** (no wallet required).
2. Open **Genesis Attestation**.
3. Stay logged into x.com in the same browser, then **Verify** on the follow task.
4. Admins: `/admin` with `ADMIN_SECRET` to create campaigns/quests and inspect user risk / sybil flags.

## Primus notes

- SDK: `@primuslabs/zktls-page-core-sdk` (no Chrome extension). WASM/worker files live in `/public`.
- Production pattern: `init(appId)` in the browser, `POST /api/primus/sign` on the server.
- Headers `COOP: same-origin` and `COEP: require-corp` are set for SharedArrayBuffer.
- Hub **template IDs** are stored on tasks for matching. X follow uses one Hub template (`674142ce-d852-4c1d-9ca3-3061ace98988` / `PRIMUS_TEMPLATE_X_FOLLOW`) for every handle. Request URL must be `https://x.com/i/api/graphql/.*/UserByScreenName\?.*`. The proof page sets `additionParams.launch_page` to `https://x.com/{handle}` so the extension opens that profile instead of the Hub template’s saved Data source URL. A frozen query hash returns Primus 00013.
- Optional: `PRIMUS_VERIFIER_ADDRESS` + `RPC_URL` for on-chain `verifyAttestation`.

## Discord

Join and role quests use a Primus zkTLS proof from the Discord website. The user must be logged into Discord in the same Chrome profile.

## Security

Never mark a task complete because the client said so. Binding: wallet session + `additionParams.userId/taskId` + `@@unique([taskId, provenIdentityHash])`.

Do not commit `.env`.
