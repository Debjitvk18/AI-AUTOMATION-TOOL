"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Film } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function ExtractFrameNode({ id, data, selected }: NodeProps) {
  const edges = useWorkflowStore((s) => s.edges);
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));
  const d = data as { videoUrl?: string; timestamp?: string };

  const vIn = edges.some((e) => e.target === id && e.targetHandle === HANDLE.extractVideo);
  const tIn = edges.some((e) => e.target === id && e.targetHandle === HANDLE.extractTs);

  return (
    <div>
      <Handle
        id={HANDLE.extractVideo}
        type="target"
        position={Position.Left}
        style={{ top: "35%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800"
      />
      <Handle
        id={HANDLE.extractTs}
        type="target"
        position={Position.Left}
        style={{ top: "65%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800"
      />
      <NodeShell
        title="Extract frame"
        icon={<Film className="h-3.5 w-3.5 text-violet-400" />}
        selected={selected}
        running={running}
      >
        <label className="block text-xs text-zinc-500 dark:text-zinc-500">Video URL (if not wired)</label>
        <input
           
           title="Video URL"
          disabled={vIn}
          value={d.videoUrl ?? ""}
          onChange={(e) => update(id, { videoUrl: e.target.value })}
          className="w-full rounded-lg border px-2 py-1 text-xs outline-none transition
            border-zinc-200 bg-zinc-50 text-zinc-800 focus:border-violet-500/50 disabled:opacity-40
            dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200"
        />
        <label className="mt-2 block text-xs text-zinc-500 dark:text-zinc-500">Timestamp (sec or %)</label>
        <input
          disabled={tIn}
          value={d.timestamp ?? "0"}
          onChange={(e) => update(id, { timestamp: e.target.value })}
          placeholder='e.g. 2.5 or "50%"'
          className="w-full rounded-lg border px-2 py-1 text-xs outline-none transition
            border-zinc-200 bg-zinc-50 text-zinc-800 focus:border-violet-500/50 disabled:opacity-40
            dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200"
        />
      </NodeShell>
      <Handle
        id={HANDLE.extractOut}
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-violet-500/60 !bg-violet-600"
      />
    </div>
  );
}
