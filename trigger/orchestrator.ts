import type { Edge, Node } from "@xyflow/react";
import { NodeRunStatus, RunStatus } from "@prisma/client";
import { task } from "@trigger.dev/sdk";
import { HANDLE } from "../lib/handles";
import { parseNodeType } from "../lib/graph";
import { executionLayers } from "../lib/plan";
import type { RunScope } from "../lib/node-types";
import { prisma } from "../lib/prisma";
import { cropImageTask } from "./crop-image";
import { extractFrameTask } from "./extract-frame";
import { httpRequestTask } from "./http-request";
import { runLlmTask } from "./run-llm";
import { sendNotificationTask } from "./send-notification";
import { parseRetryPolicy, computeDelay, isRetryableError } from "../lib/retry";

export type WorkflowOrchestratorPayload = {
  workflowRunId: string;
  workflowId: string;
  userId: string;
  scope: RunScope;
  targetNodeIds?: string[];
  graph: { nodes: Node[]; edges: Edge[] };
};

type OutputsMap = Record<string, Record<string, unknown>>;

function asRecord(d: unknown): Record<string, unknown> {
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
}

function readTextOut(outputs: OutputsMap, id: string): string | undefined {
  const o = outputs[id];
  if (!o) return undefined;
  if (typeof o.text === "string") return o.text;
  if (typeof o.outputText === "string") return o.outputText;
  if (typeof o.responseText === "string") return o.responseText;
  return undefined;
}

function readImageUrl(outputs: OutputsMap, id: string): string | undefined {
  const o = outputs[id];
  if (!o) return undefined;
  if (typeof o.url === "string") return o.url;
  if (typeof o.output === "string") return o.output;
  return undefined;
}

function readVideoUrl(outputs: OutputsMap, id: string): string | undefined {
  const o = outputs[id];
  if (!o) return undefined;
  if (typeof o.url === "string") return o.url;
  return undefined;
}

function parsePercent(s: string, fallback: number): number {
  const n = Number.parseFloat(String(s).trim());
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function resolveTextInput(
  nodeId: string,
  handle: string,
  edges: Edge[],
  outputs: OutputsMap,
  manual: string,
): string {
  const e = edges.find((x) => x.target === nodeId && x.targetHandle === handle);
  if (!e) return manual;
  const t = readTextOut(outputs, e.source);
  return t ?? manual;
}

function upstreamHasFailure(nodeId: string, edges: Edge[], failed: Set<string>): boolean {
  for (const e of edges) {
    if (e.target === nodeId && failed.has(e.source)) return true;
  }
  return false;
}

// --- If/Else evaluation ---
function evaluateCondition(
  inputText: string,
  field: string,
  operator: string,
  value: string,
): boolean {
  let fieldValue: string = inputText;

  if (field) {
    try {
      const parsed = JSON.parse(inputText);
      const keys = field.split(".");
      let current: unknown = parsed;
      for (const key of keys) {
        if (current && typeof current === "object") {
          current = (current as Record<string, unknown>)[key];
        } else {
          current = undefined;
          break;
        }
      }
      fieldValue = current !== undefined ? String(current) : "";
    } catch {
      fieldValue = inputText;
    }
  }

  switch (operator) {
    case "equals": return fieldValue === value;
    case "notEquals": return fieldValue !== value;
    case "contains": return fieldValue.includes(value);
    case "notContains": return !fieldValue.includes(value);
    case "gt": return Number(fieldValue) > Number(value);
    case "lt": return Number(fieldValue) < Number(value);
    case "isEmpty": return fieldValue.trim() === "";
    case "isNotEmpty": return fieldValue.trim() !== "";
    default: return false;
  }
}

// --- Data Transform ---
function applyTransform(input: string, operation: string, template: string): string {
  switch (operation) {
    case "jsonParse":
      try { return JSON.stringify(JSON.parse(input), null, 2); } catch { return `Parse error: ${input}`; }
    case "jsonStringify":
      return JSON.stringify(input);
    case "uppercase":
      return input.toUpperCase();
    case "lowercase":
      return input.toLowerCase();
    case "trim":
      return input.trim();
    case "template":
      return template.replace(/\{\{input\}\}/g, input);
    case "extractField": {
      try {
        const parsed = JSON.parse(input);
        const keys = template.split(".");
        let current: unknown = parsed;
        for (const key of keys) {
          if (current && typeof current === "object") {
            const match = key.match(/^(\w+)\[(\d+)\]$/);
            if (match) {
              current = (current as Record<string, unknown>)[match[1]!];
              if (Array.isArray(current)) current = current[Number(match[2])];
            } else {
              current = (current as Record<string, unknown>)[key];
            }
          } else {
            current = undefined;
            break;
          }
        }
        return current !== undefined ? (typeof current === "string" ? current : JSON.stringify(current)) : "";
      } catch { return `Extract error: invalid JSON`; }
    }
    case "base64Encode":
      return Buffer.from(input).toString("base64");
    case "base64Decode":
      return Buffer.from(input, "base64").toString("utf-8");
    default:
      return input;
  }
}

export const workflowOrchestratorTask = task({
  id: "workflow-orchestrator",
  maxDuration: 3600,
  run: async (payload: WorkflowOrchestratorPayload) => {
    const { workflowRunId, workflowId, userId, graph } = payload;
    const { nodes, edges } = graph;
    const started = Date.now();

    console.log(`[orchestrator] ▶ Starting run ${workflowRunId} (workflow: ${workflowId})`);
    console.log(`[orchestrator] Nodes: ${nodes.length}, Edges: ${edges.length}, Scope: ${payload.scope}`);

    const layers = executionLayers(payload.scope, nodes, edges, payload.targetNodeIds);
    console.log(`[orchestrator] Plan: ${layers.length} layer(s) — [${layers.map((l) => l.join(", ")).join("] → [")}]`);

    const outputs: OutputsMap = {};
    const failed = new Set<string>();

    async function markNode(
      nodeId: string,
      status: NodeRunStatus,
      patch: {
        durationMs?: number;
        inputsJson?: object;
        outputsJson?: object;
        error?: string | null;
      },
    ) {
      await prisma.nodeRun.updateMany({
        where: { runId: workflowRunId, nodeId },
        data: { status, ...patch },
      });
    }

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx]!;
      console.log(`[orchestrator] ── Layer ${layerIdx + 1}/${layers.length}: [${layer.join(", ")}]`);

      for (const nodeId of layer) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        const nodeType = parseNodeType(node);
        if (!nodeType) continue;

        console.log(`[orchestrator]   ▸ ${nodeType} (${nodeId}) — start`);
        const t0 = Date.now();

        if (upstreamHasFailure(nodeId, edges, failed)) {
          console.log(`[orchestrator]   ✗ ${nodeType} (${nodeId}) — upstream failed`);
          await markNode(nodeId, NodeRunStatus.FAILED, {
            durationMs: Date.now() - t0,
            error: "Upstream dependency failed",
            inputsJson: {},
            outputsJson: {},
          });
          failed.add(nodeId);
          continue;
        }

        await markNode(nodeId, NodeRunStatus.RUNNING, {});
        const data = asRecord(node.data);
        const retryPolicy = parseRetryPolicy(node.data);

        for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
          try {
            let out: Record<string, unknown>;

          // =============================================
          // INLINE NODES — no sub-task, instant execution
          // =============================================

          if (nodeType === "text") {
            const text = String(data.text ?? "");
            console.log(`[orchestrator]   … text: "${text.slice(0, 60)}"`);
            out = { text };

          } else if (nodeType === "uploadImage") {
            const url = String(data.url ?? "");
            if (!url) throw new Error("Image URL missing — upload a file first");
            console.log(`[orchestrator]   … uploadImage: ${url.slice(0, 60)}`);
            out = { url };

          } else if (nodeType === "uploadVideo") {
            const url = String(data.url ?? "");
            if (!url) throw new Error("Video URL missing — upload a file first");
            console.log(`[orchestrator]   … uploadVideo: ${url.slice(0, 60)}`);
            out = { url };

          } else if (nodeType === "manualTrigger") {
            const inputData = String(data.inputData ?? "{}");
            console.log(`[orchestrator]   … manualTrigger: len=${inputData.length}`);
            out = { text: inputData };

          } else if (nodeType === "webhookTrigger") {
            const lastPayload = String(data.lastPayload ?? "{}");
            console.log(`[orchestrator]   … webhookTrigger: hookId=${data.hookId}`);
            out = { text: lastPayload };

          } else if (nodeType === "scheduleTrigger") {
            const now = new Date().toISOString();
            console.log(`[orchestrator]   … scheduleTrigger: cron="${data.cron}", now=${now}`);
            out = { text: now, cron: String(data.cron ?? ""), triggeredAt: now };

          } else if (nodeType === "ifElse") {
            const inputText = resolveTextInput(nodeId, HANDLE.conditionIn, edges, outputs, "");
            const field = String(data.field ?? "");
            const operator = String(data.operator ?? "equals");
            const value = String(data.value ?? "");
            const result = evaluateCondition(inputText, field, operator, value);
            console.log(`[orchestrator]   … ifElse: "${field}" ${operator} "${value}" → ${result}`);
            out = { text: inputText, result: String(result), conditionResult: result, truePath: result, falsePath: !result };

          } else if (nodeType === "dataTransform") {
            const inputText = resolveTextInput(nodeId, HANDLE.transformIn, edges, outputs, "");
            const operation = String(data.operation ?? "jsonParse");
            const template = String(data.template ?? "");
            const transformed = applyTransform(inputText, operation, template);
            console.log(`[orchestrator]   … dataTransform: op=${operation}, in=${inputText.length}→out=${transformed.length}`);
            out = { text: transformed };

          // =============================================
          // REMOTE NODES — need Trigger.dev sub-tasks
          // =============================================

          } else if (nodeType === "llm") {
            const provider = String(data.provider ?? "gemini");
            const apiKey = String(data.apiKey ?? "").trim();
            const model = String(data.model ?? "gemini-2.5-flash");
            const systemPrompt = resolveTextInput(nodeId, HANDLE.systemPrompt, edges, outputs, String(data.systemPrompt ?? ""));
            const userMessage = resolveTextInput(nodeId, HANDLE.userMessage, edges, outputs, String(data.userMessage ?? ""));
            if (!userMessage.trim()) throw new Error("User message is required");

            const imageEdges = edges.filter((e) => e.target === nodeId && e.targetHandle === HANDLE.images);
            const imageUrls = imageEdges.map((e) => readImageUrl(outputs, e.source)).filter((u): u is string => typeof u === "string");
            console.log(`[orchestrator]   … llm: provider=${provider}, model=${model}, msg=${userMessage.length}ch, imgs=${imageUrls.length}`);

            const run = await runLlmTask.triggerAndWait({
              workflowRunId, nodeId, userId, provider, apiKey, model,
              systemPrompt: systemPrompt.trim() || undefined,
              userMessage: userMessage.trim(),
              imageUrls,
            });
            if (!run.ok) throw new Error(String(run.error ?? "LLM task failed"));
            out = run.output;

          } else if (nodeType === "cropImage") {
            const imgEdge = edges.find((e) => e.target === nodeId && e.targetHandle === HANDLE.cropImageIn);
            const manualUrl = String(data.imageUrl ?? "");
            const imageUrl = imgEdge ? readImageUrl(outputs, imgEdge.source) : manualUrl;
            if (!imageUrl) throw new Error("Crop image input is required");

            const x = Number(resolveTextInput(nodeId, HANDLE.cropX, edges, outputs, String(data.xPercent ?? 0)));
            const y = Number(resolveTextInput(nodeId, HANDLE.cropY, edges, outputs, String(data.yPercent ?? 0)));
            const w = Number(resolveTextInput(nodeId, HANDLE.cropW, edges, outputs, String(data.widthPercent ?? 100)));
            const h = Number(resolveTextInput(nodeId, HANDLE.cropH, edges, outputs, String(data.heightPercent ?? 100)));
            console.log(`[orchestrator]   … cropImage: x=${x}, y=${y}, w=${w}, h=${h}`);

            const cr = await cropImageTask.triggerAndWait({
              workflowRunId, nodeId, userId, imageUrl,
              xPercent: parsePercent(String(x), 0), yPercent: parsePercent(String(y), 0),
              widthPercent: parsePercent(String(w), 100), heightPercent: parsePercent(String(h), 100),
            });
            if (!cr.ok) throw new Error(String(cr.error ?? "Crop failed"));
            out = cr.output;

          } else if (nodeType === "extractFrame") {
            const vEdge = edges.find((e) => e.target === nodeId && e.targetHandle === HANDLE.extractVideo);
            const manualV = String(data.videoUrl ?? "");
            const videoUrl = vEdge ? readVideoUrl(outputs, vEdge.source) : manualV;
            if (!videoUrl) throw new Error("Video URL is required");

            const ts = resolveTextInput(nodeId, HANDLE.extractTs, edges, outputs, String(data.timestamp ?? "0"));
            console.log(`[orchestrator]   … extractFrame: ts=${ts}`);

            const ex = await extractFrameTask.triggerAndWait({
              workflowRunId, nodeId, userId, videoUrl, timestamp: ts,
            });
            if (!ex.ok) throw new Error(String(ex.error ?? "Extract frame failed"));
            out = ex.output;

          } else if (nodeType === "httpRequest") {
            const method = String(data.method ?? "GET");
            const url = resolveTextInput(nodeId, HANDLE.httpUrlIn, edges, outputs, String(data.url ?? ""));
            const body = resolveTextInput(nodeId, HANDLE.httpBodyIn, edges, outputs, String(data.body ?? ""));
            const headers = String(data.headers ?? "{}");
            if (!url) throw new Error("HTTP Request URL is required");
            console.log(`[orchestrator]   … httpRequest: ${method} ${url}`);

            const run = await httpRequestTask.triggerAndWait({ method, url, headers, body });
            if (!run.ok) throw new Error(String(run.error ?? "HTTP request failed"));
            out = run.output;

          } else if (nodeType === "notification") {
            const inputText = resolveTextInput(nodeId, HANDLE.notificationIn, edges, outputs, "");
            const notifType = String(data.notifType ?? "console");
            const webhookUrl = String(data.webhookUrl ?? "");
            const messageTemplate = String(data.message ?? "{{input}}");
            const message = messageTemplate.replace(/\{\{input\}\}/g, inputText);
            console.log(`[orchestrator]   … notification: type=${notifType}, msg=${message.length}ch`);

            const run = await sendNotificationTask.triggerAndWait({ notifType, webhookUrl, message });
            if (!run.ok) throw new Error(String(run.error ?? "Notification failed"));
            out = run.output;

          } else {
            throw new Error(`Unsupported node type: ${nodeType}`);
          }

            const ms = Date.now() - t0;
            outputs[nodeId] = out;
            console.log(`[orchestrator]   ✓ ${nodeType} (${nodeId}) — SUCCESS ${ms}ms (attempt ${attempt})`);
            await markNode(nodeId, NodeRunStatus.SUCCESS, {
              durationMs: ms, inputsJson: data, outputsJson: out, error: null,
            });
            break; // SUCCESS -> break retry loop

          } catch (err) {
            const ms = Date.now() - t0;
            const errMsg = err instanceof Error ? err.message : String(err);
            
            if (attempt < retryPolicy.maxAttempts && isRetryableError(retryPolicy, errMsg)) {
              const delayMs = computeDelay(retryPolicy, attempt);
              console.warn(`[orchestrator]   ⚠ ${nodeType} (${nodeId}) — FAILED ${ms}ms: ${errMsg} -> Retrying in ${delayMs}ms (attempt ${attempt}/${retryPolicy.maxAttempts})`);
              await markNode(nodeId, NodeRunStatus.RUNNING, {
                attempt: attempt + 1,
                maxAttempts: retryPolicy.maxAttempts,
                error: `Attempt ${attempt} failed: ${errMsg}`,
              });
              await new Promise(r => setTimeout(r, delayMs));
              continue; // try again
            }

            // Final failure
            failed.add(nodeId);
            console.error(`[orchestrator]   ✗ ${nodeType} (${nodeId}) — FAILED ${ms}ms: ${errMsg}`);
            await markNode(nodeId, NodeRunStatus.FAILED, {
              durationMs: ms, error: errMsg, inputsJson: data, outputsJson: {},
              attempt, maxAttempts: retryPolicy.maxAttempts,
            });
            break;
          }
        }
      }
    }

    const anyFailed = failed.size > 0;
    const anySuccess = Object.keys(outputs).length > 0;
    const finalStatus = anyFailed ? (anySuccess ? RunStatus.PARTIAL : RunStatus.FAILED) : RunStatus.SUCCESS;
    const totalMs = Date.now() - started;

    console.log(`[orchestrator] ■ Done — ${finalStatus}, ${totalMs}ms, ok=${Object.keys(outputs).length}, fail=${failed.size}`);

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { finishedAt: new Date(), durationMs: totalMs, status: finalStatus },
    });

    return { ok: true, outputs };
  },
});
