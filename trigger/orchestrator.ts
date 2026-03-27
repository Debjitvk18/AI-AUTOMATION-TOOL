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
import { passthroughTask } from "./passthrough";
import { runLlmTask } from "./run-llm";

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

export const workflowOrchestratorTask = task({
  id: "workflow-orchestrator",
  maxDuration: 3600,
  run: async (payload: WorkflowOrchestratorPayload) => {
    const { workflowRunId, userId, graph } = payload;
    const { nodes, edges } = graph;
    const started = Date.now();

    const layers = executionLayers(
      payload.scope,
      nodes,
      edges,
      payload.targetNodeIds,
    );

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
        data: {
          status,
          ...patch,
        },
      });
    }

    for (const layer of layers) {
      await Promise.all(
        layer.map(async (nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (!node) return;
          const nodeType = parseNodeType(node);
          if (!nodeType) return;

          const t0 = Date.now();

          if (upstreamHasFailure(nodeId, edges, failed)) {
            await markNode(nodeId, NodeRunStatus.FAILED, {
              durationMs: Date.now() - t0,
              error: "Upstream dependency failed",
              inputsJson: {},
              outputsJson: {},
            });
            failed.add(nodeId);
            return;
          }

          await markNode(nodeId, NodeRunStatus.RUNNING, {});

          const data = asRecord(node.data);

          try {
            let out: Record<string, unknown>;

            if (nodeType === "text") {
              const text = String(data.text ?? "");
              const run = await passthroughTask.triggerAndWait({
                body: { text },
              });
              if (!run.ok) throw new Error(String(run.error ?? "passthrough failed"));
              out = run.output;
            } else if (nodeType === "uploadImage") {
              const url = String(data.url ?? "");
              if (!url) throw new Error("Image URL missing — upload a file first");
              const run = await passthroughTask.triggerAndWait({
                body: { url },
              });
              if (!run.ok) throw new Error(String(run.error ?? "passthrough failed"));
              out = run.output;
            } else if (nodeType === "uploadVideo") {
              const url = String(data.url ?? "");
              if (!url) throw new Error("Video URL missing — upload a file first");
              const run = await passthroughTask.triggerAndWait({
                body: { url },
              });
              if (!run.ok) throw new Error(String(run.error ?? "passthrough failed"));
              out = run.output;
            } else if (nodeType === "llm") {
              const model = String(data.model ?? "gemini-2.0-flash");
              const systemPrompt = resolveTextInput(
                nodeId,
                HANDLE.systemPrompt,
                edges,
                outputs,
                String(data.systemPrompt ?? ""),
              );
              const userMessage = resolveTextInput(
                nodeId,
                HANDLE.userMessage,
                edges,
                outputs,
                String(data.userMessage ?? ""),
              );
              if (!userMessage.trim()) throw new Error("User message is required");

              const imageEdges = edges.filter(
                (e) => e.target === nodeId && e.targetHandle === HANDLE.images,
              );
              const imageUrls = imageEdges
                .map((e) => readImageUrl(outputs, e.source))
                .filter((u): u is string => typeof u === "string");

              const run = await runLlmTask.triggerAndWait({
                workflowRunId,
                nodeId,
                userId,
                model,
                systemPrompt: systemPrompt.trim() || undefined,
                userMessage: userMessage.trim(),
                imageUrls,
              });
              if (!run.ok) throw new Error(String(run.error ?? "LLM task failed"));
              out = run.output;
            } else if (nodeType === "cropImage") {
              const imgEdge = edges.find(
                (e) => e.target === nodeId && e.targetHandle === HANDLE.cropImageIn,
              );
              const manualUrl = String(data.imageUrl ?? "");
              const imageUrl = imgEdge
                ? readImageUrl(outputs, imgEdge.source)
                : manualUrl;
              if (!imageUrl) throw new Error("Crop image input is required");

              const x = Number(
                resolveTextInput(nodeId, HANDLE.cropX, edges, outputs, String(data.xPercent ?? 0)),
              );
              const y = Number(
                resolveTextInput(nodeId, HANDLE.cropY, edges, outputs, String(data.yPercent ?? 0)),
              );
              const w = Number(
                resolveTextInput(
                  nodeId,
                  HANDLE.cropW,
                  edges,
                  outputs,
                  String(data.widthPercent ?? 100),
                ),
              );
              const h = Number(
                resolveTextInput(
                  nodeId,
                  HANDLE.cropH,
                  edges,
                  outputs,
                  String(data.heightPercent ?? 100),
                ),
              );

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
              const vEdge = edges.find(
                (e) => e.target === nodeId && e.targetHandle === HANDLE.extractVideo,
              );
              const manualV = String(data.videoUrl ?? "");
              const videoUrl = vEdge ? readVideoUrl(outputs, vEdge.source) : manualV;
              if (!videoUrl) throw new Error("Video URL is required");

              const ts = resolveTextInput(
                nodeId,
                HANDLE.extractTs,
                edges,
                outputs,
                String(data.timestamp ?? "0"),
              );

              const ex = await extractFrameTask.triggerAndWait({
                workflowRunId,
                nodeId,
                userId,
                videoUrl,
                timestamp: ts,
              });
              if (!ex.ok) throw new Error(String(ex.error ?? "Extract frame failed"));
              out = ex.output;
            } else {
              throw new Error(`Unsupported node type: ${nodeType}`);
            }

            const ms = Date.now() - t0;
            outputs[nodeId] = out;
            await markNode(nodeId, NodeRunStatus.SUCCESS, {
              durationMs: ms,
              inputsJson: data,
              outputsJson: out,
              error: null,
            });
          } catch (err) {
            const ms = Date.now() - t0;
            failed.add(nodeId);
            await markNode(nodeId, NodeRunStatus.FAILED, {
              durationMs: ms,
              error: err instanceof Error ? err.message : String(err),
              inputsJson: data,
              outputsJson: {},
            });
          }
        }),
      );
    }

    const anyFailed = failed.size > 0;
    const anySuccess = Object.keys(outputs).length > 0;

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        status: anyFailed
          ? anySuccess
            ? RunStatus.PARTIAL
            : RunStatus.FAILED
          : RunStatus.SUCCESS,
      },
    });

    return { ok: true, outputs };
  },
});
