import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { isValidEdge } from "@/lib/handles";
import { parseNodeType } from "@/lib/graph";
import { wouldCreateCycle } from "@/lib/graph";
import { nodeTypeIdSchema } from "@/lib/node-types";
import { defaultNodeData } from "@/lib/workflow-graph";

type Snapshot = { nodes: Node[]; edges: Edge[] };

export type NodeRunStatus = "SUCCESS" | "FAILED" | "RUNNING" | "PENDING" | "SKIPPED";

export type WorkflowStore = {
  workflowId: string | null;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  runningNodeIds: Set<string>;
  past: Snapshot[];
  future: Snapshot[];
  // --- NEW: node selection ---
  selectedNodeId: string | null;
  // --- NEW: per-node execution status map (driven by latest run) ---
  nodeRunStatuses: Record<string, NodeRunStatus>;
  setWorkflowMeta: (id: string, name: string) => void;
  setGraph: (nodes: Node[], edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  addNode: (type: string, position?: { x: number; y: number }) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setRunning: (ids: string[]) => void;
  clearRunning: () => void;
  deleteSelected: () => void;
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  // --- NEW actions ---
  setSelectedNodeId: (id: string | null) => void;
  removeEdge: (edgeId: string) => void;
  setNodeRunStatuses: (map: Record<string, NodeRunStatus>) => void;
};

const maxHist = 45;

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled workflow",
  nodes: [],
  edges: [],
  runningNodeIds: new Set(),
  past: [],
  future: [],
  selectedNodeId: null,
  nodeRunStatuses: {},

  setWorkflowMeta: (id, name) => set({ workflowId: id, workflowName: name }),

  setGraph: (nodes, edges) => set({ nodes, edges }),

  takeSnapshot: () => {
    const { nodes, edges, past } = get();
    set({
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(
        -maxHist,
      ),
      future: [],
    });
  },

  onNodesChange: (changes) => {
    const hasMeaningful = changes.some(
      (c) => c.type !== "select" && c.type !== "dimensions" && c.type !== "position",
    );
    if (hasMeaningful) get().takeSnapshot();
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
    }));
  },

  onEdgesChange: (changes) => {
    const hasRemove = changes.some((c) => c.type === "remove");
    if (hasRemove) get().takeSnapshot();
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges),
    }));
  },

  onConnect: (c) => {
    const { nodes, edges } = get();
    const sn = nodes.find((n) => n.id === c.source);
    const tn = nodes.find((n) => n.id === c.target);
    if (!sn || !tn) return;
    const st = parseNodeType(sn);
    const tt = parseNodeType(tn);
    if (!st || !tt) return;
    if (!isValidEdge(st, c.sourceHandle, tt, c.targetHandle)) return;
    if (wouldCreateCycle(nodes, edges, { source: c.source!, target: c.target! })) return;
    get().takeSnapshot();
    set((s) => ({
      edges: addEdge(
        {
          ...c,
          id: nanoid(),
          type: "animatedPurple",
          animated: true,
        },
        s.edges,
      ),
    }));
  },

  addNode: (type, position) => {
    get().takeSnapshot();
    const id = nanoid();
    const pos = position ?? { x: 120 + Math.random() * 80, y: 120 + Math.random() * 80 };
    const parsedType = nodeTypeIdSchema.safeParse(type);
    set((s) => ({
      nodes: [
        ...s.nodes,
        {
          id,
          type,
          position: pos,
          data: parsedType.success ? defaultNodeData(parsedType.data) : {},
        },
      ],
    }));
  },

  updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    })),

  setRunning: (ids) => set({ runningNodeIds: new Set(ids) }),
  clearRunning: () => set({ runningNodeIds: new Set() }),

  deleteSelected: () => {
    const { nodes, edges } = get();
    const removeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (removeIds.size === 0) return;
    get().takeSnapshot();
    set({
      nodes: nodes.filter((n) => !removeIds.has(n.id)),
      edges: edges.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target)),
    });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (!past.length) return;
    const prev = past[past.length - 1]!;
    set({
      past: past.slice(0, -1),
      future: [{ nodes: structuredClone(nodes), edges: structuredClone(edges) }, ...future],
      nodes: prev.nodes,
      edges: prev.edges,
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (!future.length) return;
    const next = future[0]!;
    set({
      future: future.slice(1),
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(
        -maxHist,
      ),
      nodes: next.nodes,
      edges: next.edges,
    });
  },

  // --- NEW action implementations ---
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  removeEdge: (edgeId) => {
    get().takeSnapshot();
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== edgeId),
    }));
  },

  setNodeRunStatuses: (map) => set({ nodeRunStatuses: map }),
}));
