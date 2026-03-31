# NextFlow — Known Flaws & Issues

This document lists all identified flaws in the NextFlow AI Automation Flow project,
organized by severity and category, with fix status.

---

## 🔴 Critical (Blocks core functionality)

- [x] **Transloadit upload broken — no polling**
  - **Where**: `lib/transloadit.ts`
  - **Problem**: Transloadit assemblies are asynchronous. The code posted to `/assemblies` and then tried to read `results` immediately from the POST response. But Transloadit returns `ok: "ASSEMBLY_UPLOADING"` with an empty `results` object. The code fell through to `throw new Error("Transloadit response did not include a file URL")`.
  - **Fix**: Added polling logic — after creating the assembly, polls `assembly_ssl_url` every 2s until `ok === "ASSEMBLY_COMPLETED"`, with a 90s timeout. Also added fallback to read `uploads[]` array.

- [x] **Transloadit signature missing algorithm prefix**
  - **Where**: `lib/transloadit.ts`
  - **Problem**: Transloadit's API requires HMAC signatures to be prefixed with the algorithm name, e.g. `sha384:<hex>`. The old code just returned the raw hex digest.
  - **Fix**: Prepended `sha384:` to the signature output.

- [x] **LLM calls fail — GEMINI_API_KEY not on Trigger.dev cloud**
  - **Where**: `trigger/run-llm.ts` (runtime), Trigger.dev dashboard (config)
  - **Problem**: The `run-llm` task runs on Trigger.dev cloud infrastructure, which has its own environment variables. If `GEMINI_API_KEY` is only in the local `.env`, the cloud worker throws `"GEMINI_API_KEY is not set in Trigger.dev environment"`.
  - **Fix**: User must manually add `GEMINI_API_KEY` (and `TRANSLOADIT_*` keys, `DATABASE_URL`) to the Trigger.dev project dashboard under Environment Variables.

- [x] **Extract frame fails — depends on broken Transloadit**
  - **Where**: `trigger/extract-frame.ts`
  - **Problem**: After ffmpeg extracts a frame, it calls `uploadBufferToTransloadit()` to upload the PNG. Since that function was broken, the frame extraction always failed at the upload stage.
  - **Fix**: Fixed by the Transloadit polling fix above. Also needs `TRANSLOADIT_*` keys in Trigger.dev env vars.

- [x] **Crop image fails — same Transloadit dependency**
  - **Where**: `trigger/crop-image.ts`
  - **Problem**: Same as above — calls `uploadBufferToTransloadit()` for the cropped output.
  - **Fix**: Same as above.

---

## 🟡 Medium (UI/UX issues)

- [x] **Pre-defined "Sample workflow" forced on new users**
  - **Where**: `components/workflow/WorkflowPageClient.tsx`
  - **Problem**: When a user has no workflows, `bootstrap()` called `getSampleGraph()` and created a "Sample workflow" with 7 pre-placed nodes and 3 edges. Users couldn't start with an empty canvas.
  - **Fix**: Changed to create an empty workflow (`nodes: [], edges: []`) named "Untitled workflow".

- [x] **Light theme completely broken — invisible text everywhere**
  - **Where**: All components — `NodeShell`, `WorkflowShell`, `LeftSidebar`, `RightHistoryPanel`, all node components
  - **Problem**: Every component used hardcoded dark-mode Tailwind classes: `text-zinc-200`, `text-zinc-400`, `bg-zinc-950`, `border-zinc-800`, etc. In light mode, this resulted in white/light-gray text on a white background — completely unreadable.
  - **Fix**: Added `dark:` prefix variants to all color classes. Light mode now uses `text-zinc-700/800`, `bg-zinc-50/white`, `border-zinc-200/300` etc.

- [x] **Font sizes too small across all node components**
  - **Where**: All node components, sidebar, history panel
  - **Problem**: Used fixed pixel sizes: `text-[10px]`, `text-[11px]`, `text-[12px]` — extremely small and hard to read.
  - **Fix**: Bumped to Tailwind standard sizes: `text-xs` (12px) for labels, `text-sm` (14px) for inputs/content.

- [x] **Canvas dot grid hardcoded to dark color**
  - **Where**: `components/workflow/WorkflowCanvas.tsx` line 108
  - **Problem**: `<Background color="#27272f">` — a dark gray that's invisible on a white canvas background.
  - **Fix**: Made it theme-aware using `useTheme()`: dark mode = `#27272f`, light mode = `#d4d4d8`.

- [x] **MiniMap mask color hardcoded for dark**
  - **Where**: `components/workflow/WorkflowCanvas.tsx`
  - **Problem**: `maskColor="rgba(9,9,11,0.85)"` — an almost-black overlay that looks wrong on light backgrounds.
  - **Fix**: Light mode uses `rgba(255,255,255,0.85)`.

---

## 🟢 Low (Minor improvements / suggestions)

- [ ] **`sample-workflow.ts` is now unused**
  - **Where**: `lib/sample-workflow.ts`
  - **Problem**: After removing the pre-defined sample, this file is no longer imported anywhere. It's dead code.
  - **Suggestion**: Delete it or repurpose it as a template gallery feature.

- [ ] **No error feedback on upload failure in nodes**
  - **Where**: `UploadImageNode.tsx`, `UploadVideoNode.tsx`
  - **Problem**: `onFile()` has `throw new Error(...)` but nothing catches it — the error is silently swallowed. User sees no feedback if upload fails.
  - **Suggestion**: Add try/catch with a local error state, display an error message below the button.

- [ ] **No loading indicator during file upload**
  - **Where**: `UploadImageNode.tsx`, `UploadVideoNode.tsx`
  - **Problem**: When uploading a large file (especially video), there's no visual feedback that something is happening.
  - **Suggestion**: Add a loading spinner or progress state.

- [ ] **Workflow name not editable**
  - **Where**: `WorkflowShell.tsx`
  - **Problem**: The workflow name is displayed as a static `<span>` in the header. Users can't rename their workflow.
  - **Suggestion**: Make it an inline-editable input that PATCHes the name on blur.

- [ ] **No confirmation on delete/discard**
  - **Where**: `WorkflowCanvas.tsx`
  - **Problem**: Pressing Delete immediately removes selected nodes without confirmation.
  - **Suggestion**: Add a confirmation dialog for destructive actions.

- [ ] **Single workflow only**
  - **Where**: `WorkflowPageClient.tsx`
  - **Problem**: The bootstrap always picks `workflows[0]`. There's no way to list, switch between, or create additional workflows.
  - **Suggestion**: Add a workflow list/selector in the header or sidebar.

- [ ] **No auto-save**
  - **Where**: General
  - **Problem**: Users must manually click "Save". If they close the tab, unsaved work is lost.
  - **Suggestion**: Add debounced auto-save (e.g., 3s after last change).
