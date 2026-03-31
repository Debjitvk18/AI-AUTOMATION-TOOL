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
          className="min-h-[88px] w-full resize-y rounded-lg border px-2 py-1.5 text-sm outline-none transition
            border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50
            dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600"
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
