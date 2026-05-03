"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { Eye, X } from "lucide-react";
import { isValidEdge } from "@/lib/handles";
import { parseNodeType } from "@/lib/graph";
import { wouldCreateCycle } from "@/lib/graph";
import { useWorkflowStore } from "@/store/workflow-store";
import { AnimatedPurpleEdge } from "./edges/AnimatedPurpleEdge";
// Existing nodes
import { CropImageNode } from "./nodes/CropImageNode";
import { ExtractFrameNode } from "./nodes/ExtractFrameNode";
import { LlmNode } from "./nodes/LlmNode";
import { TextNode } from "./nodes/TextNode";
import { UploadImageNode } from "./nodes/UploadImageNode";
import { UploadVideoNode } from "./nodes/UploadVideoNode";
// New n8n-style nodes
import { HttpRequestNode } from "./nodes/HttpRequestNode";
import { IfElseNode } from "./nodes/IfElseNode";
import { DataTransformNode } from "./nodes/DataTransformNode";
import { WebhookTriggerNode } from "./nodes/WebhookTriggerNode";
import { NotificationNode } from "./nodes/NotificationNode";
import { ScheduleTriggerNode } from "./nodes/ScheduleTriggerNode";
import { ManualTriggerNode } from "./nodes/ManualTriggerNode";

const nodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  llm: LlmNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
  // n8n-style nodes
  httpRequest: HttpRequestNode,
  ifElse: IfElseNode,
  dataTransform: DataTransformNode,
  webhookTrigger: WebhookTriggerNode,
  notification: NotificationNode,
  scheduleTrigger: ScheduleTriggerNode,
  manualTrigger: ManualTriggerNode,
};

const edgeTypes = {
  animatedPurple: AnimatedPurpleEdge,
};

function truncateJson(obj: Record<string, unknown>, maxLen = 120): string {
  const s = JSON.stringify(obj);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function PreviewPanel() {
  const previewOutputs = useWorkflowStore((s) => s.previewOutputs);
  const clearPreview = useWorkflowStore((s) => s.clearPreview);
  const entries = Object.values(previewOutputs);
  if (entries.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2
      w-[min(720px,90%)] max-h-56 overflow-hidden rounded-2xl border shadow-2xl
      border-amber-300/40 bg-white/95 backdrop-blur-xl
      dark:border-amber-700/40 dark:bg-zinc-950/95">
      <div className="flex items-center gap-2 border-b border-amber-200/60 px-4 py-2
        dark:border-amber-800/40">
        <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Preview Results
        </span>
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600
          dark:bg-amber-900/50 dark:text-amber-300">
          {entries.length} node{entries.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={clearPreview}
          className="ml-auto rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700
            dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="Close preview"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto px-3 py-2" style={{ maxHeight: "180px" }}>
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.nodeId}
              className="flex items-start gap-2 rounded-lg bg-zinc-50/80 px-3 py-2
                dark:bg-zinc-900/60"
            >
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase
                ${entry.status === "FROM_HISTORY"
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
                }`}>
                {entry.status === "FROM_HISTORY" ? "history" : "simulated"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {entry.nodeType}
                  <span className="ml-1 text-[10px] text-zinc-400 dark:text-zinc-600">
                    ({entry.nodeId.slice(0, 8)}…)
                  </span>
                </p>
                <p className="mt-0.5 break-all text-[11px] text-zinc-500 dark:text-zinc-400">
                  {truncateJson(entry.output)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkflowCanvas() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  const isValidConnection = useCallback(
    (c: Edge | Connection) => {
      if (!c.source || !c.target) return false;
      const sn = nodes.find((n) => n.id === c.source);
      const tn = nodes.find((n) => n.id === c.target);
      if (!sn || !tn) return false;
      const st = parseNodeType(sn);
      const tt = parseNodeType(tn);
      if (!st || !tt) return false;
      const sh = c.sourceHandle ?? null;
      const th = c.targetHandle ?? null;
      if (!isValidEdge(st, sh, tt, th)) return false;
      if (wouldCreateCycle(nodes, edges, { source: c.source, target: c.target })) return false;
      return true;
    },
    [nodes, edges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "y" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, redo, undo]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        className="nf-canvas-bg"
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color={isDark ? "#27272f" : "#d4d4d8"} />
        <MiniMap
          pannable
          zoomable
          nodeStrokeColor={isDark ? "#52525b" : "#a1a1aa"}
          maskColor={isDark ? "rgba(9,9,11,0.85)" : "rgba(255,255,255,0.85)"}
          className="rounded-xl!"
        />
        <Controls showInteractive={false} />
        <Panel position="bottom-left" className="text-xs text-zinc-400 dark:text-zinc-600">
          Pan · scroll zoom · Del removes selection
        </Panel>
      </ReactFlow>
      <PreviewPanel />
    </>
  );
}
