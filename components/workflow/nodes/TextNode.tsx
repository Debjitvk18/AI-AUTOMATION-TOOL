"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Type } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function TextNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));
  const text = String((data as { text?: string }).text ?? "");

  return (
    <div>
      <NodeShell title="Text" icon={<Type className="h-3.5 w-3.5 text-violet-400" />} selected={selected} running={running}>
        <textarea
          value={text}
          onChange={(e) => update(id, { text: e.target.value })}
          placeholder="Enter text…"
          className="min-h-[88px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-1.5 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
        />
      </NodeShell>
      <Handle
        id={HANDLE.textOut}
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-violet-500/60 !bg-violet-600"
      />
    </div>
  );
}
