# NextFlow — AI-Powered Visual Workflow Automation Platform

> **A Krea.ai-inspired visual builder for LLM-centric media workflows, powered by autonomous agents, real-time execution, and cloud infrastructure.**

---

## 📋 Table of Contents

1. [Problem Statement](#-problem-statement)
2. [Approach & Thought Process](#-approach--thought-process)
3. [Tech Stack](#-tech-stack)
4. [Build Explanation](#-build-explanation)
5. [Complete Project Flow](#-complete-project-flow)
6. [Node Catalog](#-node-catalog)
7. [Agentic / Automation Architecture](#-agentic--automation-architecture)
8. [Database & Persistence](#-database--persistence)
9. [API Shape](#-api-shape)
10. [State Management](#-state-management)
11. [Current Build Report Card](#-current-build-report-card)
12. [Setup & Running Locally](#-setup--running-locally)
13. [Repository Structure](#-repository-structure)
14. [Why This Matters](#-why-this-matters)
15. [License](#-license)

---

## 🧩 Problem Statement

### What problem were we trying to solve?

Modern AI workflows are complex — they involve chaining together LLMs, media processing steps (crop, extract frames), HTTP calls, conditional logic, and more. Most people who want to build these pipelines either:

1. Write long custom scripts that are brittle and hard to debug
2. Use expensive, black-box SaaS tools that hide what's happening
3. Can't easily visualize or trace what ran, in what order, and why it failed

**NextFlow** solves this by giving any user a **visual, drag-and-drop canvas** to construct, execute, and audit multi-step AI automations — from "describe this image with Gemini" to "fetch data → transform → send Slack notification" — all with zero code.

### Why this problem?

The rise of large language models and multimodal AI (text + images + video) has created enormous demand for *composable* AI pipelines. Tools like **n8n**, **LangChain**, and **Krea.ai** point toward the future, but lack one or more of:

- Real-time visual execution feedback
- Secure server-side LLM calls (not exposed in the browser)
- Reliable cloud execution with retries and audit trails
- FFmpeg media manipulation inside the same pipeline

NextFlow combines all of these into one coherent platform.

---

## 🧠 Approach & Thought Process

### How did we break down the problem?

The build was broken into **four pillars**:

| Pillar | Responsibility |
|--------|----------------|
| **Visual Canvas** | React Flow — drag/drop, wire connections, minimap, undo/redo |
| **Execution Engine** | Trigger.dev orchestrator — runs nodes in DAG order, handles parallelism |
| **Node Processing** | Individual Trigger.dev tasks per node type (LLM, crop, extract, HTTP...) |
| **Persistence Layer** | Prisma + PostgreSQL (Neon) — workflows, run history, node-level results |

### What made our approach unique?

1. **Agentic Orchestration** — The `workflow-orchestrator` Trigger.dev task autonomously evaluates the graph's topological layers and executes each node in dependency order. It decides *which* nodes to fire, *parallelizes* independent branches, and skips failed downstream nodes automatically.

2. **Secure-by-design** — LLM API keys (Gemini) and media secrets (Transloadit) never leave the server. AI calls only happen inside Trigger.dev cloud tasks.

3. **Type-safe everything** — TypeScript strict mode, Zod on all API boundaries, and typed React Flow handles prevent invalid connections at the UI level.

4. **Real-time state feedback** — Node glow animations reflect live execution status. The right panel shows granular per-node history with inputs/outputs/errors after each run.

5. **Flexible run scopes** — Users can run *the full graph*, *selected nodes only*, or *a single node*, each tracked separately in history.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript (strict mode) |
| **UI Library** | React 19, Tailwind CSS v4, Lucide React |
| **Canvas / Graph** | React Flow (`@xyflow/react`) |
| **Authentication** | Clerk (sign-in, sign-up, protected routes) |
| **Database** | PostgreSQL via Neon (serverless) |
| **ORM** | Prisma v6 |
| **Async Job Execution** | **Trigger.dev** v4 SDK — cloud task runner |
| **Media Processing** | FFmpeg (`fluent-ffmpeg`) inside Trigger.dev tasks |
| **File Uploads / CDN** | Transloadit (async assembly polling) |
| **LLM / AI** | Google Gemini API (`@google/generative-ai`) |
| **Client State** | Zustand v5 (undo/redo, canvas state) |
| **Validation** | Zod |
| **Theming** | next-themes (dark/light mode) |

### Agentic / Automation Tools Used

- **Trigger.dev** — The core agentic runtime. Each node type is a Trigger.dev task. The orchestrator task autonomously plans and runs the full workflow graph.
- **Google Gemini** — Multimodal LLM (text + vision) called exclusively inside Trigger.dev tasks.
- **Transloadit** — Async media assembly service; server-side polling ensures large uploads complete without timeout.
- **FFmpeg** — Runs inside Trigger.dev build containers for video frame extraction and image cropping.
- **Prisma + Neon** — Persistent audit log of every workflow run and every node's execution result.

---

## 🏗 Build Explanation

### How does the solution work?

#### 1. The Visual Canvas (Front-End)

Users open their workflow at `/workflow`. The canvas is powered by **React Flow** with:

- **Dot grid background** + pan/zoom + minimap
- **Animated purple edges** between connected node handles
- **Left sidebar**: searchable node catalog organized by category (Triggers, Logic & Data, Integrations, AI & Media)
- **Right sidebar**: per-workflow run history with drill-down node results
- **Toolbar**: Save, Export/Import JSON, Run All, Run Selected, Undo/Redo

Each node has **typed handles** — colored ports that only accept compatible data types (e.g., you cannot wire an image output into a text-only input). React Flow validates connections live.

#### 2. Saving a Workflow

When a user saves, the full React Flow graph (`nodes` + `edges` arrays) is serialized as `graphJson` and updated in the `Workflow` Prisma model via a `PATCH /api/workflows/[id]` route.

#### 3. Triggering a Run (The Agentic Part)

`POST /api/workflows/[id]/runs` — the route:

1. Creates a `WorkflowRun` row (`RUNNING`) + one `NodeRun` row per node (`PENDING`)
2. Fires the **`workflow-orchestrator`** Trigger.dev task with the full graph payload
3. Returns the `workflowRunId` immediately (non-blocking)

#### 4. The Orchestrator (Autonomous Agent)

`trigger/orchestrator.ts` is the heart of the agentic execution. It:

```
graph snapshot received
        ↓
executionLayers() — topological sort → ordered layers
        ↓
for each layer (sequential):
  for each node in layer:
    ├── Check upstream failures → skip if dependency failed
    ├── Mark node RUNNING in DB
    ├── Resolve inputs from upstream outputs
    ├── Execute node (inline OR sub-task):
    │     text / uploadImage / uploadVideo / manualTrigger
    │     →  inline, instant
    │
    │     llm / cropImage / extractFrame / httpRequest / notification
    │     →  triggerAndWait() sub-task
    │
    └── Mark node SUCCESS / FAILED in DB
        ↓
Update WorkflowRun → SUCCESS / PARTIAL / FAILED
```

**Key design**: Nodes in the same topological layer have no inter-dependencies, so they could logically run in parallel. The orchestrator loops through layers sequentially but within each layer fires all independent nodes.

#### 5. Node Sub-Tasks

Each compute-heavy node has its own Trigger.dev task:

| Task File | What it does |
|-----------|-------------|
| `trigger/run-llm.ts` | Builds multimodal request (text + image URLs), calls Gemini, returns `outputText` |
| `trigger/crop-image.ts` | Downloads image via URL, runs FFmpeg crop by %, uploads result via Transloadit |
| `trigger/extract-frame.ts` | Downloads video, FFmpeg-seeks to timestamp, extracts frame, uploads image |
| `trigger/http-request.ts` | Makes HTTP GET/POST/PUT/DELETE with custom headers/body, returns response |
| `trigger/send-notification.ts` | Posts to Slack webhook or logs to Trigger.dev console |

#### 6. Data Passing Between Nodes

The orchestrator maintains an in-memory `OutputsMap` (`Record<nodeId, outputs>`). When a node connects to another, the orchestrator resolves the input by walking the edge graph:

```typescript
function resolveTextInput(nodeId, handle, edges, outputs, manual) {
  const edge = edges.find(x => x.target === nodeId && x.targetHandle === handle);
  if (!edge) return manual; // no wire → use manual field value
  return readTextOut(outputs, edge.source) ?? manual;
}
```

This means connected fields automatically receive the upstream node's output, and manual fields are disabled in the UI when a wire is present.

#### 7. Run History

After execution, the right sidebar polls `GET /api/workflows/[id]/runs` to show:
- All past runs (timestamp, status, duration, scope)
- Per-node drill-down: status badge, input snapshot, output, error message, timing

---

## 🔄 Complete Project Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                                  │
│                                                                      │
│  Sign In (Clerk) → /workflow                                         │
│       │                                                              │
│  ┌────▼──────────────────────────────────────────────────┐          │
│  │           React Flow Canvas                            │          │
│  │  Left Sidebar   │  Canvas (nodes + edges)  │ Right    │          │
│  │  (node picker)  │  dot grid, minimap        │ History  │          │
│  └────────────────────────────────────────────────────────┘          │
│       │                                                              │
│  Click "Run All" → POST /api/workflows/[id]/runs                     │
└──────────────────────│──────────────────────────────────────────────┘
                        │
              ┌─────────▼──────────────────────┐
              │      Next.js API Route          │
              │  1. Create WorkflowRun (DB)     │
              │  2. Create NodeRun rows (DB)    │
              │  3. Fire orchestrator task      │
              └─────────┬──────────────────────┘
                        │
              ┌─────────▼──────────────────────┐
              │     Trigger.dev Cloud           │
              │                                 │
              │  workflow-orchestrator task:    │
              │  ┌────────────────────────┐    │
              │  │  Layer 1: [textNode]   │    │
              │  │  Layer 2: [llmNode]    │    │
              │  │  Layer 3: [notifNode]  │    │
              │  └────────────────────────┘    │
              │         │                       │
              │  ┌──────▼─────────────────┐    │
              │  │  Sub-tasks fired:      │    │
              │  │  run-llm  →  Gemini   │    │
              │  │  crop-image → FFmpeg  │    │
              │  │  http-request → API   │    │
              │  └────────────────────────┘    │
              └─────────────────────────────────┘
                        │
              ┌─────────▼──────────────────────┐
              │   Prisma → Neon (PostgreSQL)    │
              │                                 │
              │   WorkflowRun.status = SUCCESS  │
              │   NodeRun[].outputsJson = {...} │
              └─────────────────────────────────┘
                        │
              ┌─────────▼──────────────────────┐
              │  External Services              │
              │  Transloadit (CDN uploads)      │
              │  Google Gemini (LLM + vision)   │
              │  FFmpeg (in Trigger container)  │
              └─────────────────────────────────┘
```

---

## 🗂 Node Catalog

### AI & Media Nodes

| Node | Inputs | Output | Service |
|------|--------|--------|---------|
| **Upload Image** | — (file picker) | Image URL | Transloadit |
| **Upload Video** | — (file picker) | Video URL | Transloadit |
| **Run LLM** | system_prompt, user_message, images | Text response | Google Gemini |
| **Crop Image** | image_url, x%, y%, width%, height% | Cropped image URL | FFmpeg + Transloadit |
| **Extract Frame** | video_url, timestamp | Frame image URL | FFmpeg + Transloadit |

### Trigger Nodes

| Node | Output |
|------|--------|
| **Manual Trigger** | JSON payload (user-defined) |
| **Webhook Trigger** | Incoming POST body |
| **Schedule Trigger** | Current ISO timestamp + cron |

### Logic & Data Nodes

| Node | Inputs | Output |
|------|--------|--------|
| **Text** | — | Static text string |
| **If / Else** | condition (text) | true/false + original text |
| **Data Transform** | input (text) | Transformed text (JSON, Base64, Template, etc.) |

### Integration Nodes

| Node | Inputs | Output |
|------|--------|--------|
| **HTTP Request** | URL, method, headers, body | Response body |
| **Send Notification** | message | Status text |

---

## ⚙️ Agentic / Automation Architecture

```
                    ┌──────────────────────────────────┐
                    │  NextFlow Agentic Core            │
                    │                                  │
                    │  DAG Planner                     │
                    │  ┌──────────────────────────┐   │
                    │  │ executionLayers()         │   │
                    │  │ Topological sort          │   │
                    │  │ Determines run order      │   │
                    │  └──────────────────────────┘   │
                    │           │                      │
                    │  ┌────────▼───────────────────┐  │
                    │  │ Orchestrator Loop           │  │
                    │  │                             │  │
                    │  │ Per layer:                  │  │
                    │  │  ├─ skip if upstream failed │  │
                    │  │  ├─ mark RUNNING            │  │
                    │  │  ├─ resolve inputs          │  │
                    │  │  ├─ execute (inline/task)   │  │
                    │  │  └─ mark SUCCESS/FAILED     │  │
                    │  └─────────────────────────────┘  │
                    │           │                      │
                    │  ┌────────▼───────────────────┐  │
                    │  │ Condition Evaluation        │  │
                    │  │ evaluateCondition()         │  │
                    │  │ equals/gt/lt/contains/...   │  │
                    │  └─────────────────────────────┘  │
                    │           │                      │
                    │  ┌────────▼───────────────────┐  │
                    │  │ Data Transform Engine       │  │
                    │  │ applyTransform()            │  │
                    │  │ JSON/Base64/Template/...    │  │
                    │  └─────────────────────────────┘  │
                    └──────────────────────────────────┘
```

**Non-negotiable constraints respected by the orchestrator:**
- `Trigger.dev` for all execution (no direct browser API calls)
- Gemini only called inside `run-llm` Trigger task
- DAG-only graphs (cycle detection in `lib/graph.ts`)
- Type-safe edge connections validated at wiring time

---

## 🗄 Database & Persistence

### Prisma Schema

```prisma
model Workflow {
  id        String        @id @default(cuid())
  userId    String                          // Clerk user ID
  name      String        @default("Untitled workflow")
  graphJson Json                            // Full React Flow snapshot
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  runs      WorkflowRun[]
}

model WorkflowRun {
  id           String    @id @default(cuid())
  userId       String
  workflowId   String
  scope        RunScope                    // FULL | PARTIAL | SINGLE
  status       RunStatus @default(RUNNING) // RUNNING | SUCCESS | FAILED | PARTIAL
  durationMs   Int?
  startedAt    DateTime  @default(now())
  finishedAt   DateTime?
  nodeRuns     NodeRun[]
}

model NodeRun {
  id          String        @id @default(cuid())
  runId       String
  nodeId      String
  nodeType    String
  status      NodeRunStatus               // PENDING | RUNNING | SUCCESS | FAILED | SKIPPED
  durationMs  Int?
  inputsJson  Json?
  outputsJson Json?
  error       String?
}
```

---

## 🔌 API Shape

All routes live under `app/api/` and use **Zod** for request validation:

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/workflows` | List user's workflows |
| `POST` | `/api/workflows` | Create new workflow |
| `GET` | `/api/workflows/[id]` | Load workflow + graph |
| `PATCH` | `/api/workflows/[id]` | Save graph JSON and/or workflow name |
| `DELETE` | `/api/workflows/[id]` | Delete workflow |
| `POST` | `/api/workflows/[id]/runs` | Trigger a workflow run |
| `GET` | `/api/workflows/[id]/runs` | List run history |
| `GET` | `/api/workflows/[id]/runs/[runId]` | Fetch a single run with node-level details |
| `DELETE` | `/api/workflows/[id]/runs/[runId]` | Delete a run |
| `GET` | `/api/workflows/[id]/export` | Export workflow JSON |
| `POST` | `/api/workflows/[id]/import` | Import workflow JSON |
| `POST` | `/api/upload` | Upload file → Transloadit |
| `GET` | `/api/webhooks/trigger/[hookId]` | Inspect webhook endpoint details |
| `POST` | `/api/webhooks/trigger/[hookId]` | Receive webhook payload |

**Security:** Gemini API keys and Transloadit secrets are **never exposed** to the client. All sensitive calls happen server-side or inside Trigger.dev tasks.

---

## 🧮 State Management

| Store | Technology | Responsibility |
|-------|-----------|----------------|
| Canvas state | **Zustand** | Node positions, edges, selections |
| Undo/Redo | **Zustand** + history stack | Graph edit history |
| Auth | **Clerk** | User session, middleware protection |
| Server state | React `fetch` + Next.js cache | Workflows, run history |

---

## ✅ Current Build Report Card

Snapshot date: **2026-04-09**

### Overall Status

| Area | Grade | Status |
|------|-------|--------|
| Visual Builder & UX | A- | Strong, usable workflow editor with good productivity tooling |
| Execution Engine | A- | Reliable DAG orchestration with dependency-aware execution |
| Integrations & Node Runtime | B+ | Core integrations are solid; some provider/runtime breadth can grow |
| API & Persistence | A- | Endpoints are complete for CRUD + runs + import/export |
| Production Hardening | B | Good MVP baseline; retries/rate limiting/testing still limited |

**Estimated completeness:** ~90-92% of the intended MVP platform.

### Implemented (What is already built)

| Category | Implemented Features |
|----------|----------------------|
| **Pages & Shell** | Landing page, sign-in/sign-up, workflow app shell, demo pages, theme toggle |
| **Canvas Core** | React Flow canvas, minimap, controls, typed handles, edge validation, cycle prevention |
| **Editing Experience** | Add/remove nodes, connect/disconnect edges, node data editing, undo/redo snapshots |
| **Node Catalog** | Text, Upload Image, Upload Video, Run LLM, Crop Image, Extract Frame, HTTP Request, If/Else, Data Transform, Webhook Trigger, Manual Trigger, Schedule Trigger, Send Notification |
| **Execution Planning** | FULL/PARTIAL/SINGLE scopes, topological layers, upstream dependency closure |
| **Execution Runtime** | Inline node execution for light nodes + Trigger.dev sub-tasks for heavy nodes |
| **Run Observability** | Workflow run status and node run status persisted with duration/input/output/error |
| **API Surface** | Workflow CRUD, run create/list/get/delete, import/export, upload, webhook endpoints |
| **Auth & Isolation** | Clerk-authenticated routes, user-scoped workflow queries |
| **Storage Model** | Prisma models for Workflow, WorkflowRun, NodeRun with cascade relations |
| **Validation** | Zod validation on create/update workflow and run creation payloads |

### Partially Implemented (Works, but not fully complete)

| Feature | Current State | Gap |
|---------|---------------|-----|
| **Schedule Trigger** | Cron value can be configured and used in run output | No autonomous background scheduler is wiring cron to automatic run creation |
| **Webhook Trigger** | Endpoint receives payload and stores latest payload in node data | Not a full event history system; payload storage is latest-value oriented |
| **Conditional Branching** | If/Else produces condition result fields and true/false flags | Branch-pruning visualization and strict path-only execution controls are limited |
| **Error UX** | Node errors are persisted and visible in history data | No dedicated advanced diagnostics UI (stack trace panel, retry controls) |
| **Notification Node** | Console/webhook notifications supported | Multi-channel delivery (email/SMS/provider adapters) is not implemented |

### Not Yet Built / Missing

| Area | Missing Capability |
|------|--------------------|
| **Automated Testing** | No dedicated unit/integration/e2e test suite is present |
| **API Guardrails** | Explicit rate limiting and advanced abuse controls are not present in API layer |
| **Advanced Retry Policy** | Per-node configurable retry/backoff policy is limited |
| **Workflow Versioning** | No built-in version history/branching for workflow definitions |
| **Realtime Collaboration** | No multi-user collaborative editing session support |

### Quick Feature Scorecard

| Domain | Score | Notes |
|--------|-------|-------|
| Workflow creation & editing | 9/10 | Mature editor for MVP scope |
| Workflow execution correctness | 9/10 | Good dependency handling and status tracking |
| Integrations coverage | 8/10 | Strong base set (LLM/media/webhook/http), room to expand |
| Reliability hardening | 7/10 | Good structure, needs deeper production controls |
| Developer maintainability | 9/10 | Clear folder structure, typed models, separated concerns |

---

## 🚀 Setup & Running Locally

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Trigger.dev account
- Clerk account
- Google AI Studio API key
- Transloadit account

### Environment Variables

Copy `.env.example` → `.env` and fill in:

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Database (Neon)
DATABASE_URL=postgresql://...

# Trigger.dev
TRIGGER_SECRET_KEY=tr_...

# Google Gemini
GEMINI_API_KEY=AI...

# Transloadit
TRANSLOADIT_AUTH_KEY=...
TRANSLOADIT_AUTH_SECRET=...
TRANSLOADIT_TEMPLATE_ID=...
```

### Run the Application

```bash
# 1. Install dependencies
npm install

# 2. Push DB schema
npx prisma db push

# 3. Terminal A — Next.js dev server
npm run dev

# 4. Terminal B — Trigger.dev worker (REQUIRED for workflow runs)
npm run trigger

# 5. Open in browser
# http://localhost:3000
# Sign in → /workflow
```

---

## 🗂 Repository Structure

```
nextflow/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── upload/               # Transloadit file upload
│   │   ├── webhooks/trigger/     # Webhook receiver
│   │   └── workflows/            # CRUD + run trigger routes
│   ├── sign-in/ sign-up/         # Clerk auth pages
│   └── workflow/                 # Protected workflow builder page
│
├── components/
│   └── workflow/
│       ├── nodes/                # 14 React Flow node components
│       │   ├── LlmNode.tsx
│       │   ├── CropImageNode.tsx
│       │   ├── TextNode.tsx
│       │   └── ... (11 more)
│       ├── WorkflowCanvas.tsx    # React Flow canvas wrapper
│       ├── WorkflowShell.tsx     # Main layout + toolbar
│       ├── LeftSidebar.tsx       # Node picker sidebar
│       └── RightHistoryPanel.tsx # Run history panel
│
├── lib/
│   ├── graph.ts                  # DAG utilities (cycle detection, topological helpers)
│   ├── handles.ts                # All typed handle IDs
│   ├── node-types.ts             # Zod-validated node type enum + RunScope
│   ├── plan.ts                   # executionLayers() — topological planner
│   ├── prisma.ts                 # Prisma client singleton
│   ├── schemas.ts                # Zod API schemas
│   └── transloadit.ts            # Upload + polling logic
│
├── trigger/
│   ├── orchestrator.ts           # ⚡ Agentic workflow runner (core)
│   ├── run-llm.ts                # Google Gemini task
│   ├── crop-image.ts             # FFmpeg crop task
│   ├── extract-frame.ts          # FFmpeg frame extract task
│   ├── http-request.ts           # HTTP request task
│   └── send-notification.ts      # Notification task
│
├── store/                        # Zustand stores
├── prisma/schema.prisma          # Database schema
├── trigger.config.ts             # Trigger.dev project config
├── middleware.ts                 # Clerk route protection
├── .env.example                  # All required env vars
├── NEXTFLOW_FEATURES.md          # Feature status documentation
├── SAMPLE_AUTOMATION_GUIDE.md    # Example workflows to try
├── TROUBLESHOOTING.md            # Common issues & fixes
└── RUN.md                        # Step-by-step local setup guide
```

---

## 💡 Sample Workflows to Try

### 1. "Describe This Image" (AI Vision)

```
[Text Node: "You are an expert image analyst"]
               ↓ system_prompt
[Upload Image Node] ──── images ────→ [Run LLM Node] → output on node
               ↑ user_message
[Text Node: "Describe this image in 2-3 sentences"]
```

### 2. "Fetch API Data → Transform → Notify"

```
[HTTP Request: GET https://api.example.com/data]
               ↓
[Data Transform: Extract JSON Field → "name"]
               ↓
[Data Transform: Template → "Hello, {{input}}!"]
               ↓
[Send Notification: Console Log]
```

### 3. "Video Frame Analysis"

```
[Upload Video Node]
       ↓ video_url
[Extract Frame Node (timestamp: 30s)]
       ↓ frame URL
[Run LLM Node: "What is shown at this timestamp?"]
```

---

## 🌟 Why This Matters

### What makes this project meaningful?

**1. Democratizes AI pipeline creation**
Anyone — designer, PM, researcher — can chain together Gemini vision calls, image transformations, and API requests without writing a single line of code. The visual canvas makes complex AI workflows as intuitive as drawing a flowchart.

**2. Agentic design from day one**
The orchestrator is a genuine autonomous agent: given a graph, it independently plans execution order, manages inter-node data flow, handles failures gracefully, and persists a complete audit trail. It embodies the "agentic" paradigm where software acts on behalf of users without step-by-step instructions.

**3. Production-grade underpinnings**
By running all heavy work through **Trigger.dev** (retries, observability, cloud containers with FFmpeg), the platform is architecturally ready to scale. Secrets never touch the browser. Database-backed history enables debugging and reproducibility.

**4. The media + AI intersection**
Most workflow tools treat media as a black box. NextFlow natively understands image and video pipelines — crop, extract frames, feed into vision models — opening use cases like automated content analysis, thumbnail generation, and multimodal QA.

**5. Open and extensible node system**
Adding a new node requires: a React component in `components/workflow/nodes/`, a case in the orchestrator, and optionally a new Trigger.dev task. The architecture was designed for growth.

---

## 📄 License

Private / assessment use unless otherwise specified by the author.

---

## 👤 Contact & Handoff

When continuing implementation, preserve this README as the **source of truth** for scope; update it when product decisions change (e.g., history scoping, handle type matrix, new node types).

> **Built with:** Next.js · React Flow · Trigger.dev · Google Gemini · Transloadit · FFmpeg · Prisma · Neon · Clerk · Zustand · TypeScript · Zod
