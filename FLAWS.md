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
  - **Fix**: Fixed by the Transloadit polling fix above.

- [x] **Crop image fails — same Transloadit dependency**
  - **Where**: `trigger/crop-image.ts`
  - **Fix**: Fixed by the Transloadit polling fix above.

- [x] **Workflows stuck in PENDING / extremely slow**
  - **Where**: `trigger/orchestrator.ts`, `trigger/index.ts`
  - **Problem 1**: New trigger tasks (`http-request.ts`, `send-notification.ts`) were NOT exported in `trigger/index.ts`, so Trigger.dev never registered them. `triggerAndWait` calls would hang forever.
  - **Problem 2**: Simple nodes (text, upload, triggers) were calling `passthroughTask.triggerAndWait()` — spawning a full Trigger.dev sub-task run for what's just a data passthrough, adding 5-10 seconds of overhead per node.
  - **Fix**: (1) Added missing exports to `trigger/index.ts`. (2) Rewrote orchestrator to execute simple nodes **inline** — text, upload, manualTrigger, webhookTrigger, scheduleTrigger, ifElse, dataTransform all run instantly without sub-tasks. Only LLM, crop, extractFrame, httpRequest, and notification still use `triggerAndWait`.

---

## 🟡 Medium (UI/UX issues)

- [x] **Pre-defined "Sample workflow" forced on new users**
  - **Where**: `components/workflow/WorkflowPageClient.tsx`
  - **Fix**: Changed to create an empty workflow.

- [x] **Light theme completely broken — invisible text everywhere**
  - **Where**: All components
  - **Fix**: Added `dark:` prefix variants to all color classes.

- [x] **Font sizes too small across all node components**
  - **Fix**: Bumped to Tailwind standard sizes: `text-xs` (12px) for labels, `text-sm` (14px) for inputs/content.

- [x] **Canvas dot grid hardcoded to dark color**
  - **Fix**: Made theme-aware using `useTheme()`.

- [x] **MiniMap mask color hardcoded for dark**
  - **Fix**: Light mode uses `rgba(255,255,255,0.85)`.

- [x] **No delete button for run history entries**
  - **Where**: `components/workflow/RightHistoryPanel.tsx`
  - **Problem**: Users couldn't clean up old/failed run history.
  - **Fix**: Added trash icon button next to each run, calls `DELETE /api/workflows/{id}/runs/{runId}` and removes from list.

---

## 🟢 Low (Minor improvements / suggestions)

- [x] **`sample-workflow.ts` is now unused**
  - **Where**: `lib/sample-workflow.ts`
  - **Fix**: Deleted the file.

- [x] **No error feedback on upload failure in nodes**
  - **Where**: `UploadImageNode.tsx`, `UploadVideoNode.tsx`
  - **Fix**: Added try/catch with local error state. Error message shown in red below the button.

- [x] **No loading indicator during file upload**
  - **Where**: `UploadImageNode.tsx`, `UploadVideoNode.tsx`
  - **Fix**: Added `Loader2` spinner and "Uploading…" text. Button disabled while uploading.

- [ ] **Workflow name not editable**
  - **Where**: `WorkflowShell.tsx`
  - **Suggestion**: Make it an inline-editable input that PATCHes the name on blur.

- [ ] **Single workflow only**
  - **Where**: `WorkflowPageClient.tsx`
  - **Suggestion**: Add a workflow list/selector in the header or sidebar.

- [ ] **No auto-save**
  - **Suggestion**: Add debounced auto-save (e.g., 3s after last change).
