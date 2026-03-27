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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect } from "react";
import { isValidEdge } from "@/lib/handles";
import { parseNodeType } from "@/lib/graph";
import { wouldCreateCycle } from "@/lib/graph";
import { useWorkflowStore } from "@/store/workflow-store";
import { AnimatedPurpleEdge } from "./edges/AnimatedPurpleEdge";
import { CropImageNode } from "./nodes/CropImageNode";
import { ExtractFrameNode } from "./nodes/ExtractFrameNode";
import { LlmNode } from "./nodes/LlmNode";
import { TextNode } from "./nodes/TextNode";
import { UploadImageNode } from "./nodes/UploadImageNode";
import { UploadVideoNode } from "./nodes/UploadVideoNode";

const nodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  llm: LlmNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
};

const edgeTypes = {
  animatedPurple: AnimatedPurpleEdge,
};

export function WorkflowCanvas() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);

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
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      fitView
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      className="nf-canvas-bg"
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#27272f" />
      <MiniMap
        pannable
        zoomable
        nodeStrokeColor="#52525b"
        maskColor="rgba(9,9,11,0.85)"
        className="rounded-xl!"
      />
      <Controls showInteractive={false} />
      <Panel position="bottom-left" className="text-[10px] text-zinc-600">
        Pan · scroll zoom · Del removes selection
      </Panel>
    </ReactFlow>
  );
}
