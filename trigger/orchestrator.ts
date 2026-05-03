import type { Edge, Node } from "@xyflow/react";
import { NodeRunStatus, RunStatus } from "@prisma/client";
import { task } from "@trigger.dev/sdk";
import { HANDLE } from "../lib/handles";
import { parseNodeType, topologicalLayers } from "../lib/graph";
import { executionLayers } from "../lib/plan";
import type { RunScope } from "../lib/node-types";
import { prisma } from "../lib/prisma";
import { cropImageTask } from "./crop-image";
import { extractFrameTask } from "./extract-frame";
import { httpRequestTask } from "./http-request";
import { runLlmTask } from "./run-llm";
import { sendNotificationTask } from "./send-notification";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export type WorkflowOrchestratorPayload = {
  workflowRunId: string;
  workflowId: string;
  userId: string;
  scope: RunScope;
  targetNodeIds?: string[];
  resumeFromNodeId?: string;
  graph: { nodes: Node[]; edges: Edge[] };
};

type OutputsMap = Record<string, Record<string, unknown>>;
type SwitchCondition = { operator?: unknown; value?: unknown; outputHandle?: unknown };

const SWITCH_VALUE_IN_HANDLE = "switch-value-in";
const SWITCH_DEFAULT_OUTPUT_HANDLE = "default";
const NODE_OUTPUT_EXPR_GLOBAL = /\{\{\$node\["([^"]+)"\]\.output\}\}/g;
const NODE_OUTPUT_EXPR_EXACT = /^\{\{\$node\["([^"]+)"\]\.output\}\}$/;

function stringifyLoopItem(item: unknown): string {
  if (typeof item === "string") return item;
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function parseItemsInput(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      if (value.trim().length > 0) return [value];
    }
  }
  return [];
}

function readItemsOut(outputs: OutputsMap, id: string): unknown[] | undefined {
  const o = outputs[id];
  if (!o) return undefined;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.outputs)) return o.outputs;
  if (Array.isArray(o.array)) return o.array;
  if (typeof o.text === "string") {
    const parsed = parseItemsInput(o.text);
    if (parsed.length > 0) return parsed;
  }
  return undefined;
}

function resolveLoopItemsInput(
  nodeId: string,
  edges: Edge[],
  outputs: OutputsMap,
  manual: unknown,
): unknown[] {
  const incoming = edges.find((e) => e.target === nodeId);
  if (incoming) {
    const fromSource = readItemsOut(outputs, incoming.source);
    if (fromSource) return fromSource;
  }
  return parseItemsInput(manual);
}

function collectDownstreamNodeIds(startNodeId: string, edges: Edge[]): string[] {
  const seen = new Set<string>();
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const direct = edges.filter((e) => e.source === current).map((e) => e.target);
    for (const target of direct) {
      if (target === startNodeId || seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }

  return [...seen];
}

function normalizeSwitchConditions(raw: unknown): Array<{ operator: string; value: string; outputHandle: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ operator: string; value: string; outputHandle: string }> = [];
  for (const row of raw) {
    const c = row as SwitchCondition;
    if (!c || typeof c !== "object") continue;
    const outputHandle = String(c.outputHandle ?? "").trim();
    if (!outputHandle) continue;
    out.push({
      operator: String(c.operator ?? "equals").trim() || "equals",
      value: String(c.value ?? ""),
      outputHandle,
    });
  }
  return out;
}

function evaluateSwitchCondition(inputValue: string, operator: string, conditionValue: string): boolean {
  const op = operator.toLowerCase();

  if (op === "equals" || op === "eq") return inputValue === conditionValue;
  if (op === "notequals" || op === "ne") return inputValue !== conditionValue;
  if (op === "contains") return inputValue.includes(conditionValue);
  if (op === "startswith") return inputValue.startsWith(conditionValue);
  if (op === "endswith") return inputValue.endsWith(conditionValue);

  const leftNum = Number(inputValue);
  const rightNum = Number(conditionValue);
  const numeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);
  if (numeric) {
    if (op === "gt") return leftNum > rightNum;
    if (op === "gte") return leftNum >= rightNum;
    if (op === "lt") return leftNum < rightNum;
    if (op === "lte") return leftNum <= rightNum;
  }

  return false;
}

function resolveSwitchInput(
  nodeId: string,
  edges: Edge[],
  outputs: OutputsMap,
  manual: unknown,
): string {
  const manualString = String(manual ?? "");
  const byKnownHandle = resolveTextInput(nodeId, SWITCH_VALUE_IN_HANDLE, edges, outputs, manualString);
  if (byKnownHandle !== manualString || manualString.trim().length > 0) {
    return byKnownHandle;
  }

  const anyIncoming = edges.find((e) => e.target === nodeId);
  if (!anyIncoming) return manualString;
  const fromUpstream = readTextOut(outputs, anyIncoming.source);
  return fromUpstream ?? manualString;
}

function computeSwitchSkipNodeIds(
  nodeId: string,
  selectedOutputHandle: string,
  edges: Edge[],
): string[] {
  const switchOutEdges = edges.filter((e) => e.source === nodeId);
  const selectedRoots = switchOutEdges
    .filter((e) => String(e.sourceHandle ?? "") === selectedOutputHandle)
    .map((e) => e.target);
  const nonSelectedRoots = switchOutEdges
    .filter((e) => String(e.sourceHandle ?? "") !== selectedOutputHandle)
    .map((e) => e.target);

  const selectedDesc = new Set<string>();
  for (const root of selectedRoots) {
    selectedDesc.add(root);
    for (const id of collectDownstreamNodeIds(root, edges)) {
      selectedDesc.add(id);
    }
  }

  const nonSelectedDesc = new Set<string>();
  for (const root of nonSelectedRoots) {
    nonSelectedDesc.add(root);
    for (const id of collectDownstreamNodeIds(root, edges)) {
      nonSelectedDesc.add(id);
    }
  }

  return [...nonSelectedDesc].filter((id) => !selectedDesc.has(id));
}

function asRecord(d: unknown): Record<string, unknown> {
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
}

function asOutputRecord(d: unknown): Record<string, unknown> | null {
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
}

function readTextOut(outputs: OutputsMap, id: string): string | undefined {
  const o = outputs[id];
  if (!o) return undefined;
  if (typeof o.text === "string") return o.text;
  if (typeof o.outputText === "string") return o.outputText;
  if (typeof o.responseText === "string") return o.responseText;
  return undefined;
}

function parseNodeOutputExpression(expression: string): { nodeId: string } | null {
  const match = expression.match(NODE_OUTPUT_EXPR_EXACT);
  if (!match) return null;
  return { nodeId: match[1]! };
}

function stringifyExpressionValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readNodeOutputForExpression(outputs: OutputsMap, nodeId: string): string | undefined {
  const nodeOutput = outputs[nodeId];
  if (!nodeOutput) return undefined;

  const explicitOutput = stringifyExpressionValue(nodeOutput.output);
  if (explicitOutput !== undefined) return explicitOutput;

  const textFallback = readTextOut(outputs, nodeId);
  if (textFallback !== undefined) return textFallback;

  if (typeof nodeOutput.url === "string") return nodeOutput.url;
  return undefined;
}

function resolveNodeExpressions(input: string, outputs: OutputsMap): string {
  if (!input.includes("{{$node[\"")) return input;

  return input.replace(NODE_OUTPUT_EXPR_GLOBAL, (fullMatch) => {
    const parsed = parseNodeOutputExpression(fullMatch);
    if (!parsed) return fullMatch;

    const resolved = readNodeOutputForExpression(outputs, parsed.nodeId);
    return resolved ?? fullMatch;
  });
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
  const manualResolved = resolveNodeExpressions(manual, outputs);
  const e = edges.find((x) => x.target === nodeId && x.targetHandle === handle);
  if (!e) return manualResolved;
  const t = readTextOut(outputs, e.source);
  const resolved = t ?? manualResolved;
  return resolveNodeExpressions(resolved, outputs);
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
    const { workflowRunId, workflowId, userId, graph, resumeFromNodeId } = payload;
    const { nodes, edges } = graph;
    const started = Date.now();

    console.log(`[orchestrator] ▶ Starting run ${workflowRunId} (workflow: ${workflowId})`);
    console.log(`[orchestrator] Nodes: ${nodes.length}, Edges: ${edges.length}, Scope: ${payload.scope}`);

    const layers = executionLayers(payload.scope, nodes, edges, payload.targetNodeIds);
    console.log(`[orchestrator] Plan: ${layers.length} layer(s) — [${layers.map((l) => l.join(", ")).join("] → [")}]`);

    const outputs: OutputsMap = {};
    const failed = new Set<string>();
    const skipped = new Set<string>();
    const retryCountByNode = new Map<string, number>();
    const loopManagedNodes = new Set<string>();

    const previousNodeRuns = await prisma.nodeRun.findMany({
      where: { runId: workflowRunId },
      select: {
        nodeId: true,
        status: true,
        outputsJson: true,
      },
    });

    const previousStatusByNodeId = new Map<string, NodeRunStatus>();
    const successNodeIds = new Set<string>();
    for (const nodeRun of previousNodeRuns) {
      previousStatusByNodeId.set(nodeRun.nodeId, nodeRun.status);

      if (nodeRun.status === NodeRunStatus.SUCCESS) {
        successNodeIds.add(nodeRun.nodeId);
        const restoredOutputs = asOutputRecord(nodeRun.outputsJson);
        outputs[nodeRun.nodeId] = restoredOutputs ?? {};
      }

      if (nodeRun.status === NodeRunStatus.FAILED) {
        failed.add(nodeRun.nodeId);
      }
    }

    const executionOrder = layers.flat();
    const requestedResumeFrom = resumeFromNodeId?.trim();
    const requestedResumeIsInPlan =
      Boolean(requestedResumeFrom) && executionOrder.includes(requestedResumeFrom!);
    const firstFailedInPlan = executionOrder.find(
      (nodeId) => previousStatusByNodeId.get(nodeId) === NodeRunStatus.FAILED,
    );
    const resumeStartNodeId = requestedResumeIsInPlan
      ? requestedResumeFrom
      : firstFailedInPlan;
    let reachedResumeStart = !resumeStartNodeId;

    if (requestedResumeFrom && !requestedResumeIsInPlan) {
      console.warn(
        `[orchestrator] resumeFromNodeId=${requestedResumeFrom} is not in execution plan; falling back to first FAILED node if available.`,
      );
    }

    if (resumeStartNodeId) {
      console.log(`[orchestrator] Resume enabled from node ${resumeStartNodeId}`);
    }

    if (successNodeIds.size > 0) {
      console.log(`[orchestrator] Restored outputs for ${successNodeIds.size} SUCCESS node(s)`);
    }

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

    async function executeNodeForLoop(
      nodeId: string,
      outputsCtx: OutputsMap,
      failedCtx: Set<string>,
      skippedCtx: Set<string>,
      edgesCtx: Edge[],
    ): Promise<Record<string, unknown> | null> {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const rawNodeType = String(node.type ?? "");
      const nodeType = parseNodeType(node);
      if (!nodeType && rawNodeType !== "switch") return null;
      const data = asRecord(node.data);

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          let out: Record<string, unknown>;

          if (nodeType === "text") {
            out = { text: String(data.text ?? "") };

          } else if (nodeType === "uploadImage") {
            const url = String(data.url ?? "");
            if (!url) throw new Error("Image URL missing — upload a file first");
            out = { url };

          } else if (nodeType === "uploadVideo") {
            const url = String(data.url ?? "");
            if (!url) throw new Error("Video URL missing — upload a file first");
            out = { url };

          } else if (nodeType === "manualTrigger") {
            out = { text: String(data.inputData ?? "{}") };

          } else if (nodeType === "webhookTrigger") {
            out = { text: String(data.lastPayload ?? "{}") };

          } else if (nodeType === "scheduleTrigger") {
            const now = new Date().toISOString();
            out = { text: now, cron: String(data.cron ?? ""), triggeredAt: now };

          } else if (nodeType === "ifElse") {
            const inputText = resolveTextInput(nodeId, HANDLE.conditionIn, edgesCtx, outputsCtx, "");
            const field = String(data.field ?? "");
            const operator = String(data.operator ?? "equals");
            const value = String(data.value ?? "");
            const result = evaluateCondition(inputText, field, operator, value);
            out = { text: inputText, result: String(result), conditionResult: result, truePath: result, falsePath: !result };

          } else if (nodeType === "dataTransform") {
            const inputText = resolveTextInput(nodeId, HANDLE.transformIn, edgesCtx, outputsCtx, "");
            const operation = String(data.operation ?? "jsonParse");
            const template = String(data.template ?? "");
            out = { text: applyTransform(inputText, operation, template) };

          } else if (rawNodeType === "switch") {
            const inputValue = resolveSwitchInput(nodeId, edgesCtx, outputsCtx, data.value);
            const conditions = normalizeSwitchConditions(data.conditions);
            const matched = conditions.find((c) =>
              evaluateSwitchCondition(inputValue, c.operator, c.value),
            );
            const selectedOutputHandle = matched?.outputHandle ?? String(data.defaultOutputHandle ?? SWITCH_DEFAULT_OUTPUT_HANDLE);
            for (const skipId of computeSwitchSkipNodeIds(nodeId, selectedOutputHandle, edgesCtx)) {
              skippedCtx.add(skipId);
            }
            out = {
              text: inputValue,
              selectedOutputHandle,
              matched: Boolean(matched),
            };

          } else if (nodeType === "llm") {
            const provider = String(data.provider ?? "gemini");
            const apiKey = String(data.apiKey ?? "").trim();
            const model = String(data.model ?? "gemini-2.5-flash");
            const systemPrompt = resolveTextInput(nodeId, HANDLE.systemPrompt, edgesCtx, outputsCtx, String(data.systemPrompt ?? ""));
            const userMessage = resolveTextInput(nodeId, HANDLE.userMessage, edgesCtx, outputsCtx, String(data.userMessage ?? ""));
            if (!userMessage.trim()) throw new Error("User message is required");

            const imageEdges = edgesCtx.filter((e) => e.target === nodeId && e.targetHandle === HANDLE.images);
            const imageUrls = imageEdges.map((e) => readImageUrl(outputsCtx, e.source)).filter((u): u is string => typeof u === "string");
            const run = await runLlmTask.triggerAndWait({
              workflowRunId,
              nodeId,
              userId,
              provider,
              apiKey,
              model,
              systemPrompt: systemPrompt.trim() || undefined,
              userMessage: userMessage.trim(),
              imageUrls,
            });
            if (!run.ok) throw new Error(String(run.error ?? "LLM task failed"));
            out = run.output;

          } else if (nodeType === "cropImage") {
            const imgEdge = edgesCtx.find((e) => e.target === nodeId && e.targetHandle === HANDLE.cropImageIn);
            const manualUrl = String(data.imageUrl ?? "");
            const imageUrl = imgEdge ? readImageUrl(outputsCtx, imgEdge.source) : manualUrl;
            if (!imageUrl) throw new Error("Crop image input is required");

            const x = Number(resolveTextInput(nodeId, HANDLE.cropX, edgesCtx, outputsCtx, String(data.xPercent ?? 0)));
            const y = Number(resolveTextInput(nodeId, HANDLE.cropY, edgesCtx, outputsCtx, String(data.yPercent ?? 0)));
            const w = Number(resolveTextInput(nodeId, HANDLE.cropW, edgesCtx, outputsCtx, String(data.widthPercent ?? 100)));
            const h = Number(resolveTextInput(nodeId, HANDLE.cropH, edgesCtx, outputsCtx, String(data.heightPercent ?? 100)));

            const cr = await cropImageTask.triggerAndWait({
              workflowRunId,
              nodeId,
              userId,
              imageUrl,
              xPercent: parsePercent(String(x), 0),
              yPercent: parsePercent(String(y), 0),
              widthPercent: parsePercent(String(w), 100),
              heightPercent: parsePercent(String(h), 100),
            });
            if (!cr.ok) throw new Error(String(cr.error ?? "Crop failed"));
            out = cr.output;

          } else if (nodeType === "extractFrame") {
            const vEdge = edgesCtx.find((e) => e.target === nodeId && e.targetHandle === HANDLE.extractVideo);
            const manualV = String(data.videoUrl ?? "");
            const videoUrl = vEdge ? readVideoUrl(outputsCtx, vEdge.source) : manualV;
            if (!videoUrl) throw new Error("Video URL is required");

            const ts = resolveTextInput(nodeId, HANDLE.extractTs, edgesCtx, outputsCtx, String(data.timestamp ?? "0"));
            const ex = await extractFrameTask.triggerAndWait({ workflowRunId, nodeId, userId, videoUrl, timestamp: ts });
            if (!ex.ok) throw new Error(String(ex.error ?? "Extract frame failed"));
            out = ex.output;

          } else if (nodeType === "httpRequest") {
            const method = String(data.method ?? "GET");
            const url = resolveTextInput(nodeId, HANDLE.httpUrlIn, edgesCtx, outputsCtx, String(data.url ?? ""));
            const body = resolveTextInput(nodeId, HANDLE.httpBodyIn, edgesCtx, outputsCtx, String(data.body ?? ""));
            const headers = String(data.headers ?? "{}");
            if (!url) throw new Error("HTTP Request URL is required");

            const run = await httpRequestTask.triggerAndWait({ method, url, headers, body });
            if (!run.ok) throw new Error(String(run.error ?? "HTTP request failed"));
            out = run.output;

          } else if (nodeType === "notification") {
            const inputText = resolveTextInput(nodeId, HANDLE.notificationIn, edgesCtx, outputsCtx, "");
            const notifType = String(data.notifType ?? "console");
            const webhookUrl = String(data.webhookUrl ?? "");
            const messageTemplate = String(data.message ?? "{{input}}");
            const message = messageTemplate.replace(/\{\{input\}\}/g, inputText);

            const run = await sendNotificationTask.triggerAndWait({ notifType, webhookUrl, message });
            if (!run.ok) throw new Error(String(run.error ?? "Notification failed"));
            out = run.output;

          } else if (nodeType === "loop") {
            throw new Error("Nested loop execution is not supported");

          } else {
            throw new Error(`Unsupported node type: ${nodeType}`);
          }

          outputsCtx[nodeId] = out;
          failedCtx.delete(nodeId);
          return out;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          failedCtx.add(nodeId);
          console.error(`[orchestrator][loop] ✗ ${nodeType} (${nodeId}) — FAILED: ${errMsg}`);
          return null;
        }
      }

      return null;
    }

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx]!;
      console.log(`[orchestrator] ── Layer ${layerIdx + 1}/${layers.length}: [${layer.join(", ")}]`);

      for (const nodeId of layer) {
        if (!reachedResumeStart) {
          if (nodeId !== resumeStartNodeId) {
            console.log(`[orchestrator]   ↷ skipping ${nodeId} (before resume start)`);
            continue;
          }
          reachedResumeStart = true;
          console.log(`[orchestrator]   ↺ resume start reached at ${nodeId}`);
        }

        if (loopManagedNodes.has(nodeId)) {
          console.log(`[orchestrator]   ↷ skipping ${nodeId} (already executed inside loop)`);
          continue;
        }
        if (skipped.has(nodeId)) {
          console.log(`[orchestrator]   ↷ skipping ${nodeId} (switch-pruned branch)`);
          continue;
        }
        if (successNodeIds.has(nodeId)) {
          console.log(`[orchestrator]   ↷ skipping ${nodeId} (already SUCCESS from previous execution)`);
          continue;
        }

        const node = nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        const rawNodeType = String(node.type ?? "");
        const nodeType = parseNodeType(node);
        if (!nodeType && rawNodeType !== "switch") continue;

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
        retryCountByNode.set(nodeId, 0);

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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

          } else if (nodeType === "loop") {
            const items = resolveLoopItemsInput(nodeId, edges, outputs, data.items);
            console.log(`[orchestrator]   … loop: items=${items.length}`);

            const downstreamIds = collectDownstreamNodeIds(nodeId, edges);
            if (downstreamIds.length === 0) {
              out = { items: [], count: items.length };
            } else {
              for (const downstreamId of downstreamIds) {
                loopManagedNodes.add(downstreamId);
              }

              const downstreamIdSet = new Set(downstreamIds);
              const downstreamEdges = edges.filter(
                (e) => downstreamIdSet.has(e.source) && downstreamIdSet.has(e.target),
              );
              const downstreamLayers = topologicalLayers(downstreamIds, downstreamEdges);

              const iterationResults: Array<Record<string, unknown>> = [];
              const downstreamAggregates = new Map<string, unknown[]>();
              const downstreamFailureCounts = new Map<string, number>();

              for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const itemText = stringifyLoopItem(item);
                const iterationOutputs: OutputsMap = {
                  ...outputs,
                  [nodeId]: {
                    item,
                    index,
                    text: itemText,
                    outputText: itemText,
                  },
                };
                const iterationFailed = new Set<string>();
                const iterationSkipped = new Set<string>();

                for (const loopLayer of downstreamLayers) {
                  for (const downstreamId of loopLayer) {
                    if (iterationSkipped.has(downstreamId)) {
                      continue;
                    }
                    if (upstreamHasFailure(downstreamId, downstreamEdges, iterationFailed)) {
                      iterationFailed.add(downstreamId);
                      downstreamFailureCounts.set(
                        downstreamId,
                        (downstreamFailureCounts.get(downstreamId) ?? 0) + 1,
                      );
                      continue;
                    }

                    const downstreamOut = await executeNodeForLoop(
                      downstreamId,
                      iterationOutputs,
                      iterationFailed,
                      iterationSkipped,
                      downstreamEdges,
                    );

                    if (downstreamOut) {
                      const agg = downstreamAggregates.get(downstreamId) ?? [];
                      agg.push(downstreamOut);
                      downstreamAggregates.set(downstreamId, agg);
                    } else {
                      downstreamFailureCounts.set(
                        downstreamId,
                        (downstreamFailureCounts.get(downstreamId) ?? 0) + 1,
                      );
                    }
                  }
                }

                iterationResults.push({
                  index,
                  item,
                  failedNodeIds: [...iterationFailed],
                  outputs: Object.fromEntries(
                    downstreamIds
                      .filter((id) => iterationOutputs[id] !== undefined)
                      .map((id) => [id, iterationOutputs[id]!]),
                  ),
                });
              }

              for (const downstreamId of downstreamIds) {
                const aggregatedItems = downstreamAggregates.get(downstreamId) ?? [];
                const failuresForNode = downstreamFailureCounts.get(downstreamId) ?? 0;
                const allFailed =
                  items.length > 0 && aggregatedItems.length === 0 && failuresForNode > 0;

                await markNode(downstreamId, allFailed ? NodeRunStatus.FAILED : NodeRunStatus.SUCCESS, {
                  durationMs: Date.now() - t0,
                  inputsJson: { loopNodeId: nodeId, itemCount: items.length },
                  outputsJson: { items: aggregatedItems },
                  error: allFailed
                    ? `Loop iterations failed for all ${items.length} item(s)`
                    : failuresForNode > 0
                      ? `Loop had ${failuresForNode} failed item iteration(s)`
                      : null,
                });

                if (allFailed) {
                  failed.add(downstreamId);
                } else {
                  failed.delete(downstreamId);
                }

                outputs[downstreamId] = { items: aggregatedItems };
              }

              out = {
                items: iterationResults,
                count: items.length,
              };
            }

          } else if (nodeType === "webhookTrigger") {
            const lastPayload = String(data.lastPayload ?? "{}");
            console.log(`[orchestrator]   … webhookTrigger: hookId=${data.hookId}`);
            out = { text: lastPayload };

          } else if (rawNodeType === "switch") {
            const inputValue = resolveSwitchInput(nodeId, edges, outputs, data.value);
            const conditions = normalizeSwitchConditions(data.conditions);
            const matched = conditions.find((c) =>
              evaluateSwitchCondition(inputValue, c.operator, c.value),
            );
            const selectedOutputHandle =
              matched?.outputHandle ?? String(data.defaultOutputHandle ?? SWITCH_DEFAULT_OUTPUT_HANDLE);

            const skipNodeIds = computeSwitchSkipNodeIds(nodeId, selectedOutputHandle, edges);
            for (const skipId of skipNodeIds) {
              if (skipId === nodeId || skipped.has(skipId)) continue;
              skipped.add(skipId);
              await markNode(skipId, NodeRunStatus.SKIPPED, {
                durationMs: Date.now() - t0,
                inputsJson: { switchNodeId: nodeId, selectedOutputHandle },
                outputsJson: {},
                error: `Skipped by switch branch: ${selectedOutputHandle}`,
              });
            }

            out = {
              text: inputValue,
              selectedOutputHandle,
              matched: Boolean(matched),
            };

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
            failed.delete(nodeId);
            const retryCount = retryCountByNode.get(nodeId) ?? 0;
            console.log(`[orchestrator]   ✓ ${nodeType} (${nodeId}) — SUCCESS ${ms}ms (attempt ${attempt}, retries=${retryCount})`);
            await markNode(nodeId, NodeRunStatus.SUCCESS, {
              durationMs: ms, inputsJson: data, outputsJson: out, error: null,
            });
            break; // SUCCESS -> break retry loop

          } catch (err) {
            const ms = Date.now() - t0;
            const errMsg = err instanceof Error ? err.message : String(err);

            if (attempt < MAX_ATTEMPTS) {
              retryCountByNode.set(nodeId, attempt);
              console.warn(`[orchestrator]   ⚠ ${nodeType} (${nodeId}) — FAILED ${ms}ms: ${errMsg} -> Retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt}/${MAX_ATTEMPTS})`);
              await markNode(nodeId, NodeRunStatus.RUNNING, {
                error: `Attempt ${attempt} failed: ${errMsg}`,
              });
              await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
              continue; // try again
            }

            // Final failure — enrich with upstream context for auto-repair
            failed.add(nodeId);
            console.error(`[orchestrator]   ✗ ${nodeType} (${nodeId}) — FAILED ${ms}ms: ${errMsg}`);

            // Snapshot upstream outputs for the repair engine
            const upstreamSnapshot: Record<string, Record<string, unknown>> = {};
            for (const e of edges) {
              if (e.target === nodeId && outputs[e.source]) {
                upstreamSnapshot[e.source] = outputs[e.source]!;
              }
            }

            await markNode(nodeId, NodeRunStatus.FAILED, {
              durationMs: ms,
              error: errMsg,
              inputsJson: data,
              outputsJson: { _failureContext: { upstreamOutputs: upstreamSnapshot } },
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
