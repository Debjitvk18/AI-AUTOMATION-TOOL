import type { Edge, Node } from "@xyflow/react";
import { topologicalLayers, transitiveUpstream } from "@/lib/graph";
import type { RunScope } from "@/lib/node-types";

export function computeExecutableNodeIds(
  scope: RunScope,
  nodes: Node[],
  edges: Edge[],
  targetNodeIds: string[] | undefined,
): string[] {
  const all = nodes.map((n) => n.id);
  if (scope === "FULL") return all;

  const targets = targetNodeIds?.length ? targetNodeIds : [];
  if (!targets.length) {
    throw new Error("targetNodeIds required for partial or single runs");
  }

  if (scope === "SINGLE") {
    const one = targets[0];
    const closure = transitiveUpstream([one], edges);
    return [...closure];
  }

  /* PARTIAL */
  const closure = transitiveUpstream(targets, edges);
  return [...closure];
}

export function executionLayers(
  scope: RunScope,
  nodes: Node[],
  edges: Edge[],
  targetNodeIds: string[] | undefined,
): string[][] {
  const subset = new Set(computeExecutableNodeIds(scope, nodes, edges, targetNodeIds));
  const subNodes = nodes.filter((n) => subset.has(n.id)).map((n) => n.id);
  const subEdges = edges.filter((e) => subset.has(e.source) && subset.has(e.target));
  return topologicalLayers(subNodes, subEdges);
}
