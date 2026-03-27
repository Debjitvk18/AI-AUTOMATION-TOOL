# How to run NextFlow

This guide walks you from a fresh clone to a working local app with the database, Next.js, and Trigger.dev.

## Prerequisites

- **Node.js** 20+ (matches Next.js 15 / Trigger runtimes)
- **npm** (or `pnpm` / `yarn` if you adapt commands)
- Accounts (free tiers are fine): **Clerk**, **Neon** (or any Postgres), **Trigger.dev**, **Google AI Studio** (Gemini), **Transloadit**

## 1. Install dependencies

```bash
cd "d:\MY ALL PROJECTS\KERA CLONE"
npm install
```

## 2. Configure environment variables

1. Open **`.env`** in the project root (or copy **`.env.example`** to **`.env.local`**).
2. Replace every `REPLACE_ME` / placeholder with real values:

| Variable | Where to get it |
|----------|-------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your application → API Keys |
| `DATABASE_URL` | [Neon](https://neon.tech) connection string, or local Postgres URL |
| `TRIGGER_SECRET_KEY` | [Trigger.dev](https://cloud.trigger.dev) → Project → **Development** API key |
| `TRIGGER_PROJECT_REF` | Same dashboard → Project settings → **Project ref** (also used in `trigger.config.ts`) |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `TRANSLOADIT_*` | [Transloadit](https://transloadit.com) auth key/secret + a **Template** that accepts file uploads |

3. **Important for runs:** In the Trigger.dev dashboard, open **Project → Environment variables** and add **`GEMINI_API_KEY`** (and any other secrets your tasks need, e.g. Transloadit vars if tasks call them). Tasks run on Trigger’s infrastructure, not only in Next.js.

4. **Clerk URLs:** For local dev, allowed origins should include `http://localhost:3000` (Clerk → **Domains** / **Paths** as needed).

## 3. Create database tables

```bash
npx prisma db push
```

(Use `npx prisma migrate dev` instead if you prefer versioned migrations.)

## 4. Run two processes

You need **both** the Next.js app and the Trigger.dev dev process so workflow runs can execute.

### Terminal A — Next.js

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up / sign in; you should land on **`/workflow`**.

### Terminal B — Trigger.dev (required for runs)

```bash
npm run trigger
```

Leave this running. It registers tasks from the `trigger/` folder and connects to your Trigger.dev project.

Without this (or without deploying tasks to Trigger’s cloud), API calls that trigger **`workflow-orchestrator`** will not execute successfully.

## 5. Quick verification

1. **Auth:** `/` redirects to `/workflow` when logged in; `/workflow` requires login.
2. **Canvas:** A sample workflow may be created automatically if you have no workflows yet.
3. **Save:** Use **Save** in the toolbar after editing the graph.
4. **Run:** Use **Run all** or **Run selected** (select nodes first). Check the **Workflow history** panel and the Trigger.dev dashboard for run logs.

## Common commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run db:push` | `prisma db push` |
| `npm run db:studio` | Prisma Studio (browse DB) |
| `npm run trigger` / `npm run trigger:dev` | Trigger.dev local dev |

## Troubleshooting

- **Clerk “Missing publishableKey”** — Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env` or `.env.local` and restart `npm run dev`.
- **Prisma errors** — Ensure `DATABASE_URL` is correct and Postgres is reachable; rerun `npx prisma db push`.
- **Runs stuck or fail instantly** — Confirm `npm run trigger` (or `npm run trigger:dev`) is running, `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_REF` match your project, and task env vars (e.g. `GEMINI_API_KEY`) are set in Trigger.dev.
- **Upload / crop / extract errors** — Check Transloadit template ID and credentials; FFmpeg tasks rely on Trigger’s **ffmpeg** build extension (`trigger.config.ts`).

## Production / deployment (later)

Deploy Next.js (e.g. Vercel), run migrations against production Postgres, set the same env vars in the host and in Trigger.dev, then deploy tasks with `npx trigger.dev@latest deploy` per [Trigger.dev docs](https://trigger.dev/docs). This repo is optimized for local development first.
dev