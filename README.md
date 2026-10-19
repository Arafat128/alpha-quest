# Alpha Quest

A public page for trying [Primus zkTLS](https://primuslabs.xyz). Open the site, click a proof, and Primus checks one fact from a site you are already logged into in this browser. The proof does not include the rest of the account.

Live: https://alpha-quest-kappa.vercel.app

## Try it

Use Chrome with the Primus extension installed.

1. Open the site.
2. For an X proof, be logged into X in that same Chrome profile.
3. For the Discord proof, be logged into Discord and in the Primus Labs server.
4. Click the task and stay on the tab Primus opens until it finishes.

No Alpha Quest account is required.

## Run locally

```bash
cp .env.example .env
```

Fill `.env` from the Primus Developer Hub, Neon, and Discord. Do not commit `.env`.

```bash
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

In the Primus project, allow both `http://localhost:3000` and the live site. Otherwise the extension reports that the source has not been authorized.

## Stack

Next.js 14, TypeScript, Tailwind, Prisma, Neon Postgres.
