/**
 * Preview Engine — Dry Run Simulator
 *
 * Traverses the workflow graph in topological order and simulates
 * each node's output WITHOUT calling any external services.
 *
 * Reuses the existing executionLayers() planner for traversal order.
 */

import type { Edge, Node } from "@xyflow/react";
import { topologicalLayers } from "@/lib/graph";
import { simulateNode, type SimulatedOutput } from "@/lib/simulate-node";
import { HANDLE } from "@/lib/handles";

type OutputsMap = Record<string, Record<string, unknown>>;

interface PreviousNodeResult {
  nodeId: string;
  nodeType: string;
  outputsJson: Record<string, unknown> | null;
}

/**
 * Main entry point: simulate entire workflow and return per-node results.
 */
export function simulateWorkflow(
  nodes: Node[],
  edges: Edge[],
  previousResults?: PreviousNodeResult[],
): SimulatedOutput[] {
  const nodeIds = nodes.map((n) => n.id);
  const layers = topologicalLayers(nodeIds, edges);
  const outputs: OutputsMap = {};
  const results: SimulatedOutput[] = [];

  // Index previous successful results by nodeId
  const previousByNodeId = new Map<string, Record<string, unknown>>();
  if (previousResults) {
    for (const pr of previousResults) {
      if (pr.outputsJson && typeof pr.outputsJson === "object") {
        previousByNodeId.set(pr.nodeId, pr.outputsJson);
      }
    }
  }

  for (const layer of layers) {
    for (const nodeId of layer) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const nodeType = String(node.type ?? "");
      const data = (node.data && typeof node.data === "object" ? node.data : {}) as Record<string, unknown>;

      // Check for previous run data first
      const prevOutput = previousByNodeId.get(nodeId);
      if (prevOutput && Object.keys(prevOutput).length > 0 && !prevOutput._failureContext) {
        outputs[nodeId] = prevOutput;
        results.push({
          nodeId,
          nodeType,
          status: "FROM_HISTORY",
          output: prevOutput,
        });
        continue;
      }

      // Resolve inputs from upstream outputs
      const resolvedInputs = resolveInputsForPreview(nodeId, nodeType, edges, outputs, data);

      // Simulate the node
      const simulated = simulateNode(nodeType, data, resolvedInputs);
      outputs[nodeId] = simulated;

      results.push({
        nodeId,
        nodeType,
        status: "SIMULATED",
        output: simulated,
      });
    }
  }

  return results;
}

/**
 * Resolve text inputs from upstream nodes, mirroring the orchestrator's
 * resolveTextInput logic but in a lightweight, synchronous way.
 */
function resolveInputsForPreview(
  nodeId: string,
  nodeType: string,
  edges: Edge[],
  outputs: OutputsMap,
  data: Record<string, unknown>,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  // Map of nodeType -> [handleId, resolvedKey] pairs
  const handleMap: Record<string, Array<[string, string]>> = {
    llm: [
      [HANDLE.systemPrompt, "systemPrompt"],
      [HANDLE.userMessage, "userMessage"],
    ],
    httpRequest: [
      [HANDLE.httpUrlIn, "url"],
      [HANDLE.httpBodyIn, "body"],
    ],
    ifElse: [[HANDLE.conditionIn, "conditionInput"]],
    dataTransform: [[HANDLE.transformIn, "transformInput"]],
    notification: [[HANDLE.notificationIn, "message"]],
    cropImage: [[HANDLE.cropImageIn, "imageUrl"]],
    extractFrame: [[HANDLE.extractVideo, "videoUrl"]],
  };

  const handles = handleMap[nodeType];
  if (handles) {
    for (const [handleId, key] of handles) {
      resolved[key] = resolveTextFromUpstream(nodeId, handleId, edges, outputs, String(data[key] ?? ""));
    }
  }

  return resolved;
}

function readTextOut(outputs: OutputsMap, id: string): string | undefined {
  const o = outputs[id];
  if (!o) return undefined;
  if (typeof o.text === "string") return o.text;
  if (typeof o.outputText === "string") return o.outputText;
  if (typeof o.responseText === "string") return o.responseText;
  return undefined;
}

function resolveTextFromUpstream(
  nodeId: string,
  handle: string,
  edges: Edge[],
  outputs: OutputsMap,
  manual: string,
): string {
  const e = edges.find((x) => x.target === nodeId && x.targetHandle === handle);
  if (!e) return manual;
  return readTextOut(outputs, e.source) ?? manual;
}
