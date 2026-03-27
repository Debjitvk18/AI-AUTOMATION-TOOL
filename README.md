# NextFlow

**NextFlow** is a pixel-focused UI/UX clone of [Krea.ai](https://krea.ai)’s workflow builder, scoped **only to LLM-centric media workflows**. The app uses **React Flow** for the canvas, **Clerk** for auth, **PostgreSQL (Neon) + Prisma** for persistence, **Transloadit** for uploads, and **Google Gemini** for LLM calls. **All node execution runs through Trigger.dev tasks** (including FFmpeg-backed crop and frame extraction).

> **Onboarding note for AI agents:** Read this file end-to-end before changing code. It encodes product intent, non-negotiable constraints, data flow, and where future work belongs.

---

## Table of contents

1. [Product goals](#product-goals)
2. [Non-negotiable constraints](#non-negotiable-constraints)
3. [Tech stack](#tech-stack)
4. [High-level architecture](#high-level-architecture)
5. [UI / UX (Krea parity)](#ui--ux-krea-parity)
6. [Authentication](#authentication)
7. [Workflow canvas & React Flow](#workflow-canvas--react-flow)
8. [Node catalog (six Quick Access types)](#node-catalog-six-quick-access-types)
9. [Edges, handles & type safety](#edges-handles--type-safety)
10. [Execution model](#execution-model)
11. [Trigger.dev tasks](#triggerdev-tasks)
12. [External services](#external-services)
13. [Data & persistence](#data--persistence)
14. [Workflow history](#workflow-history)
15. [API shape (conceptual)](#api-shape-conceptual)
16. [State management](#state-management)
17. [Planned folder structure](#planned-folder-structure)
18. [Development workflow](#development-workflow)
19. [Deployment (later)](#deployment-later)
20. [Deliverables checklist](#deliverables-checklist)
21. [Requirements audit (original spec vs this codebase)](#requirements-audit-original-spec-vs-this-codebase)

---

## Product goals

- **Visual workflow builder** that feels like Krea: layout, sidebars, dot grid, minimap, animations, spacing, and scroll behavior.
- **LLM-first workflows**: chain text, images, and video-derived frames through a **Run Any LLM** node with Gemini.
- **Media ops** (crop, extract frame) via **FFmpeg inside Trigger.dev**, outputs re-uploaded (e.g. Transloadit) and exposed as URLs on nodes.
- **Reliable execution**: DAG validation, parallel branches, selective runs (single / multi / full), full audit trail in the **right sidebar**.

---

## Non-negotiable constraints

| Constraint | Detail |
|------------|--------|
| **Trigger.dev for execution** | Every node run (LLM, crop, extract frame, and orchestrated workflow runs) must be implemented as Trigger.dev tasks or orchestrations that only invoke work through tasks. |
| **Gemini via Trigger** | Google Generative AI (`@google/generative-ai`) runs **inside** Trigger.dev tasks, not directly from the browser for production runs. |
| **Clerk** | Sign-in/up, protected routes, user-scoped workflows and history. |
| **PostgreSQL** | Workflows, run history, node-level history — persisted; use **Neon** as the hosted DB in production. |
| **Type safety** | TypeScript **strict**, Zod on API boundaries, typed React Flow nodes/edges. |
| **DAG only** | Graph must stay acyclic; cycles rejected in validation. |
| **LLM results on-node** | LLM output is shown **on the LLM node** (expand/inline), not a separate “output” node. |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js** (App Router) |
| Language | **TypeScript** (strict) |
| UI | **React**, **Tailwind CSS**, **Lucide React** |
| Canvas | **React Flow** (@xyflow/react) — dot grid, pan/zoom, **MiniMap**, animated edges |
| Auth | **Clerk** |
| DB | **PostgreSQL** (Neon) + **Prisma** |
| Jobs | **Trigger.dev** (v4 SDK) |
| Uploads | **Transloadit** |
| Media | **FFmpeg** (in Trigger tasks) |
| LLM | **Google Gemini API** (`@google/generative-ai`) |
| Client/global state | **Zustand** |
| Validation | **Zod** |

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js (App Router)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Clerk       │  │ API Routes   │  │ Server Components / pages│ │
│  │ middleware  │  │ + Zod        │  │ (protected workflow UI)  │ │
└──┴─────────────┴──┴──────────────┴──┴────────────────────────────┴─┘
         │                    │                        │
         │                    ▼                        │
         │            ┌───────────────┐                │
         │            │ Prisma → Neon │◄───────────────┘
         │            └───────────────┘
         │                    │
         ▼                    ▼
   User session         Workflows, runs,
                        node history rows

┌─────────────────────────────────────────────────────────────────┐
│                        Trigger.dev Cloud                           │
│  Tasks: runLLM, cropImage, extractFrame, runWorkflow (orchestrate)│
│  FFmpeg + Gemini + Transloadit server-side only                  │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ triggers / webhooks / status
         │
┌────────┴────────┐     ┌─────────────┐     ┌─────────────────────┐
│ Transloadit     │     │ Google      │     │ FFmpeg (in task     │
│ (uploads/CDN)   │     │ Gemini API  │     │  container / image) │
└─────────────────┘     └─────────────┘     └─────────────────────┘
```

**Browser** never holds API secrets for Gemini or Transloadit assembly-only secrets for sensitive operations; the app uses server routes and Trigger tasks.

---

## UI / UX (Krea parity)

- **Left sidebar**: Collapsible; **search** + **Quick Access** with **exactly six** node-type buttons (see [Node catalog](#node-catalog-six-quick-access-types)). Drag and/or click to add nodes.
- **Center**: React Flow canvas — **dot grid** background, smooth **pan** (drag background) and **zoom** (wheel), **fit view**, **MiniMap** bottom-right, **animated purple edges** between handles.
- **Right sidebar**: **Workflow History** — list of runs (timestamp, status, duration, scope: full / partial / single). Click a run → **node-level** detail (inputs, outputs, timings, errors). Color badges: green success, red failed, yellow running.
- **Responsive**: Sidebars and canvas reflow; overflow scroll where Krea-style panels scroll.
- **Running nodes**: **Pulsating glow** on nodes currently executing.
- **Loading**: Spinners / disabled actions during API and task transitions.

**Reference:** Creators should sign in to **krea.ai** and study spacing, typography, dark theme, node chrome, and micro-interactions before claiming “pixel-perfect.”

---

## Authentication

- **Clerk** for sign-in, sign-up, session.
- **Middleware** (or equivalent) protects all `/workflow` (and related) routes.
- **User association**: Prisma models include `userId` (Clerk user id) on workflows and run records.

---

## Workflow canvas & React Flow

- **Nodes** registered as custom types: `text`, `uploadImage`, `uploadVideo`, `llm`, `cropImage`, `extractFrame`.
- **Undo/redo** for graph edits (add/remove/move/connect) — Zustand + history or dedicated middleware.
- **Deletion**: context/menu + **Delete/Backspace** when nodes focused.
- **DAG validation** before run: topological order; **reject cycles**.

---

## Node catalog (six Quick Access types)

### 1. Text Node

- **UI:** `textarea` for content.
- **Output:** One handle — **text** data to downstream nodes.

### 2. Upload Image Node

- **Upload:** Transloadit; types: `jpg`, `jpeg`, `png`, `webp`, `gif`.
- **UI:** Image preview after upload.
- **Output:** Image URL handle.

### 3. Upload Video Node

- **Upload:** Transloadit; types: `mp4`, `mov`, `webm`, `m4v`.
- **UI:** Video player preview.
- **Output:** Video URL handle.

### 4. Run Any LLM Node

- **UI:** Model dropdown (Gemini models per [Google docs](https://ai.google.dev/gemini-api/docs/models)); optional **system** and **user** message fields; image attachments for vision.
- **Input handles (3):**
  - `system_prompt` — optional, from Text node.
  - `user_message` — **required**, from Text node.
  - `images` — optional, multiple connections from image-producing nodes.
- **Output (1):** `outputText` — LLM response.
- **Execution:** Trigger.dev task; aggregates chained inputs from connected upstream nodes into the prompt.
- **Result:** Rendered **on the node** (expand / inline), not a separate output node.

### 5. Crop Image Node

- **Provider:** FFmpeg inside Trigger.dev; result uploaded (Transloadit) → **cropped image URL**.
- **Input handles (5):**
  - `image_url` — **required** (image types).
  - `x_percent`, `y_percent`, `width_percent`, `height_percent` — optional numeric/text 0–100; defaults `0,0,100,100`.
- **Output:** `output` — cropped image URL.

### 6. Extract Frame from Video Node

- **Provider:** FFmpeg inside Trigger.dev; frame uploaded → image URL.
- **Input handles (2):**
  - `video_url` — **required** (video MIME family).
  - `timestamp` — optional; seconds **or** `"50%"` style percentage; default `0`.
- **Output:** `output` — extracted frame image URL.

---

## Edges, handles & type safety

- **Animated edges** (purple) between compatible handles.
- **Invalid connections** are prevented in UI (or rejected on connect): e.g. image → text-only prompt handle where disallowed; text → video-only input, etc. (Exact matrix should match handle `dataType` metadata on nodes.)
- **Connected inputs:** When a handle has an incoming edge, the **manual field** for that input is **disabled** and styled muted — value comes from upstream.

---

## Execution model

1. **Full workflow run** — execute in topological order; **parallelize** independent branches (nodes with satisfied deps run concurrently).
2. **Partial / selected nodes** — run only chosen nodes + dependencies; history records scope.
3. **Single node run** — run one node with available inputs; history records scope.

Each run creates a **history entry**; expanding shows **per-node** status, inputs snapshot, outputs, duration, errors (partial success still lists successful nodes).

---

## Trigger.dev tasks

| Task | Responsibility |
|------|----------------|
| `runLLM` (name TBD) | Build multimodal request from inputs; call Gemini; return text (+ optional usage metadata). |
| `cropImage` | Download image URL, FFmpeg crop by %, upload result, return URL. |
| `extractFrame` | Download video, FFmpeg seek, upload frame image, return URL. |
| `runWorkflow` (orchestrator) | Optional: coordinate multi-node run with parallelism and persistence hooks. |

**Parallelism:** Scheduler respects DAG: only **direct dependencies** block a node; siblings run in parallel when possible.

---

## External services

| Service | Role |
|---------|------|
| **Clerk** | Auth UI + sessions |
| **Neon** | PostgreSQL |
| **Trigger.dev** | All execution, retries, observability |
| **Transloadit** | Uploads and storing processed assets |
| **Google AI Studio / Gemini** | LLM + vision |

---

## Data & persistence

**Prisma models (conceptual):**

- `Workflow` — id, userId, name, `graphJson` (React Flow snapshot or normalized), timestamps.
- `WorkflowRun` — id, userId, workflowId, scope (`full` \| `partial` \| `single`), status, startedAt, finishedAt, durationMs, metadata.
- `NodeRun` (or embedded JSON) — runId, nodeId, nodeType, status, inputsJson, outputsJson, error, durationMs, order.

**Export/import:** Workflow graph as **JSON** (plus optional run export later).

---

## Workflow history

- **Right panel** lists all runs for the current user/workflow (product decision: per-workflow vs global — implement per spec).
- **Entry fields:** timestamp, status (success / failed / partial / running), duration, scope label.
- **Drill-down:** Node-level rows with inputs/outputs and errors; partial runs show mixed success/failure clearly.

---

## API shape (conceptual)

- REST or Route Handlers under `app/api/...` with **Zod** parsing.
- Typical routes: save/load workflow, list runs, trigger run (delegates to Trigger.dev), webhook/status from Trigger if needed.
- **Never** expose `GEMINI_API_KEY` or Transloadit secrets to the client.

---

## State management

- **Zustand** for canvas UI state, selection, transient run state, undo stacks.
- **Server state** via React Query or fetch + cache patterns (project may standardize on one).

---

## Repository layout

```
├── app/                    # App Router: pages, API routes
├── components/workflow/    # Canvas, sidebars, nodes, edges
├── lib/                    # Prisma, Zod schemas, graph helpers, Transloadit
├── store/                  # Zustand workflow store (undo/redo)
├── trigger/                # Trigger.dev tasks + orchestrator
├── prisma/schema.prisma
├── trigger.config.ts
├── .env.example
├── RUN.md                  # How to run locally (step-by-step)
└── README.md
```

---

## Development workflow

1. Fill **`.env`** (or copy **`.env.example`** → **`.env.local`**) with real keys — see **[RUN.md](./RUN.md)** for step-by-step setup.
2. `npm install`
3. `npx prisma db push` (or `prisma migrate dev`) against your Neon/dev Postgres.
4. Terminal A: `npm run dev` — Next.js.
5. Terminal B: `npm run trigger` (same as `npm run trigger:dev`) — Trigger.dev dev CLI (required for workflow runs).
6. Open `/workflow` after signing in with Clerk.

`app/layout.tsx` uses `export const dynamic = "force-dynamic"` so `next build` does not require Clerk keys at build time; you still need real keys at **runtime** for auth.

---

## Deployment (later)

- Not required for the initial build phase.
- Expect **Vercel** (or similar) for Next.js, **Neon** for DB, **Trigger.dev** cloud for tasks; env vars from `.env.example` mapped to host dashboards.

---

## Deliverables checklist

- [x] Krea-inspired dark UI (layout, sidebars, nodes, dot grid, minimap)
- [x] Clerk + protected routes + user-scoped workflows/runs
- [x] Left sidebar: six Quick Access nodes + search + collapse
- [x] Right sidebar: workflow history + expandable node-level detail
- [x] React Flow: dot grid, minimap, pan/zoom, animated purple edges
- [x] Six node types (Text, uploads, LLM, crop, extract frame)
- [x] Gemini (vision + system instruction) via Trigger.dev `run-llm` task
- [x] Crop + extract frame via FFmpeg (Trigger `ffmpeg` build extension) + Transloadit upload
- [x] Pulsating glow CSS on running nodes; loading states on toolbar / LLM run
- [x] DAG validation + type-safe connections + disabled fields when wired
- [x] Undo/redo, delete selection, full / partial / single runs (orchestrator parallelizes by layer)
- [x] Prisma + PostgreSQL models for workflows + run history
- [x] Export/import workflow JSON
- [x] Sample workflow on first create
- [x] TypeScript strict, Zod on API bodies

---

## Requirements audit (original spec vs this codebase)

The table below compares the **original product brief** (Krea-style workflow builder, six nodes, Trigger.dev, etc.) to what is implemented. Items marked **Partial** work in a subset of cases or differ in UX from the brief.

| Area | Status | Notes |
|------|--------|--------|
| **Pixel-perfect Krea UI** | **Partial** | Dark theme, layout, dot grid, minimap, purple edges, and spacing are **Krea-inspired**, not a measured pixel-perfect clone of krea.ai. |
| **Left sidebar: search + 6 Quick Access + collapse** | **Met** | Implemented. |
| **Drag nodes from sidebar onto canvas** | **Not met** | Nodes are added via **click** (and sidebar items are draggable for future drop-on-canvas, but canvas **drop** is not wired). |
| **Right sidebar: workflow history** | **Met** | List + expand + node-level rows, status colors, Prisma persistence. |
| **React Flow: dot grid, pan, zoom, MiniMap** | **Met** | `Background` dots, controls, minimap. |
| **Animated purple edges** | **Met** | Custom edge type + CSS dash animation. |
| **Six node types (spec handles & behavior)** | **Partial / met** | All six exist. LLM uses **handles** for images (multiple edges), not a separate multi-file picker on the node beyond chaining image nodes. Crop/extract **output URLs** are persisted in history; **inline URL preview on those nodes after run** is minimal vs “show on node” wording. |
| **Clerk auth + protected routes + user scoping** | **Met** | Middleware + `userId` on workflows/runs. |
| **All execution via Trigger.dev** | **Met** | Orchestrator + `passthrough-node`, `run-llm`, `crop-image`, `extract-frame`. |
| **Gemini in Trigger tasks only** | **Met** | `run-llm` task uses `@google/generative-ai`. |
| **DAG + no cycles + typed connections** | **Met** | `wouldCreateCycle`, `isValidEdge`, disabled manual inputs when wired. |
| **LLM output on-node** | **Met** | `lastOutput` on LLM node. |
| **Parallel execution of independent branches** | **Met** | Orchestrator runs by **topological layer** with `Promise.all` (same-layer nodes in parallel). |
| **Full / partial / single runs + history scope** | **Met** | API + orchestrator + `RunScope`. |
| **Undo/redo** | **Met** | Zustand history for graph edits. |
| **Delete nodes (keyboard / menu)** | **Partial** | **Delete/Backspace** supported; **context/menu delete** on node not implemented. |
| **Pulsating glow while executing** | **Partial** | CSS class exists; **`runningNodeIds` is not fully driven** for every node during a full graph run (toolbar loading + LLM single-run path are the main UX). |
| **Transloadit uploads** | **Met** | Server `POST /api/upload` → Transloadit; not the browser Uppy/Transloadit plugin, same outcome. |
| **FFmpeg crop / extract in Trigger** | **Met** | `fluent-ffmpeg` + `ffmpeg` build extension; upload result via Transloadit. |
| **Workflow save/load DB** | **Met** | Prisma `Workflow.graphJson`. |
| **History persistence (Postgres)** | **Met** | `WorkflowRun` + `NodeRun`. |
| **Export/import JSON** | **Met** | API routes + toolbar. |
| **Sample workflow** | **Met** | Created when user has no workflows. |
| **Zod on APIs** | **Met** | `lib/schemas.ts`. |
| **Responsive layout** | **Partial** | Basic flex layout; not fully tuned for all breakpoints like a dedicated responsive pass. |

**Summary:** Core architecture, auth, graph editor, Trigger.dev execution, Gemini, FFmpeg nodes, persistence, and history match the brief. The largest intentional gaps vs “pixel-perfect Krea” are **visual parity**, **drag-to-canvas**, **rich running-node feedback for full runs**, and **extra polish** (responsive, node context menu, inline media URLs on non-LLM nodes).

---

## License

Private / assessment use unless otherwise specified by the author.

---

## Contact & handoff

When continuing implementation, preserve this README as the **source of truth** for scope; update it if product decisions change (e.g. history scoping, exact handle type matrix).
