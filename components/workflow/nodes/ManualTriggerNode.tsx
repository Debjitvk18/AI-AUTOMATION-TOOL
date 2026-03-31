"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Play } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function ManualTriggerNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));

  const d = data as { inputData?: string; lastOutput?: string };

  const inputCls = `w-full rounded-lg border px-2 py-1 text-sm outline-none transition
    border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50
    dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600`;

  return (
    <div className="min-w-[240px] max-w-[340px]">
      <NodeShell title="Manual Trigger" icon={<Play className="h-3.5 w-3.5 text-emerald-400" />} selected={selected} running={running}>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Input Data (JSON)</label>
        <textarea value={d.inputData ?? "{}"} onChange={(e) => update(id, { inputData: e.target.value })}
          placeholder='{"key": "value"}'
          className={`min-h-[72px] resize-y font-mono ${inputCls}`} />

        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          This data will be passed downstream when you click "Run all" or "Run selected".
        </p>

        {d.lastOutput ? (
          <pre className="mt-2 max-h-24 overflow-auto rounded-lg border p-2 text-xs whitespace-pre-wrap break-all
            border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
            {d.lastOutput}
          </pre>
        ) : null}
      </NodeShell>
      <Handle id={HANDLE.triggerOut} type="source" position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-emerald-500/60 !bg-emerald-500" />
    </div>
  );
}
