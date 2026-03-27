import type { Edge, Node } from "@xyflow/react";
import { nodeTypeIdSchema, type NodeTypeId } from "@/lib/node-types";

export function parseNodeType(n: Node): NodeTypeId | null {
  const t = nodeTypeIdSchema.safeParse(n.type);
  return t.success ? t.data : null;
}

/** Returns true if adding edge (source→target) creates a cycle in the directed graph. */
export function wouldCreateCycle(
  nodes: Node[],
  edges: Edge[],
  newEdge: Pick<Edge, "source" | "target">,
): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (!adj.has(e.source)) continue;
    adj.get(e.source)!.push(e.target);
  }
  if (!adj.has(newEdge.source)) return false;
  adj.get(newEdge.source)!.push(newEdge.target);

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(id: string): boolean {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    stack.add(id);
    for (const t of adj.get(id) ?? []) {
      if (dfs(t)) return true;
    }
    stack.delete(id);
    return false;
  }

  for (const n of nodes) {
    if (dfs(n.id)) return true;
  }
  return false;
}

export function transitiveUpstream(targetIds: string[], edges: Edge[]): Set<string> {
  const rev = new Map<string, string[]>();
  for (const e of edges) {
    if (!rev.has(e.target)) rev.set(e.target, []);
    rev.get(e.target)!.push(e.source);
  }
  const out = new Set<string>(targetIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...out]) {
      for (const up of rev.get(id) ?? []) {
        if (!out.has(up)) {
          out.add(up);
          changed = true;
        }
      }
    }
  }
  return out;
}

/** Kahn-style layering for parallel execution. */
export function topologicalLayers(nodeIds: string[], edges: Edge[]): string[][] {
  const idSet = new Set(nodeIds);
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }
  const layers: string[][] = [];
  let frontier = nodeIds.filter((id) => inDegree.get(id) === 0);
  const processed = new Set<string>();
  while (frontier.length) {
    layers.push([...frontier]);
    const next: string[] = [];
    for (const id of frontier) {
      processed.add(id);
      for (const t of adj.get(id) ?? []) {
        const d = (inDegree.get(t) ?? 0) - 1;
        inDegree.set(t, d);
        if (d === 0) next.push(t);
      }
    }
    frontier = next;
  }
  if (processed.size !== nodeIds.length) {
    throw new Error("Graph contains a cycle or invalid subgraph");
  }
  return layers;
}
