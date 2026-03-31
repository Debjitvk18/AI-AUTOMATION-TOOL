"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Crop } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function CropImageNode({ id, data, selected }: NodeProps) {
  const edges = useWorkflowStore((s) => s.edges);
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));
  const d = data as {
    imageUrl?: string;
    xPercent?: number;
    yPercent?: number;
    widthPercent?: number;
    heightPercent?: number;
  };

  const cImage = edges.some((e) => e.target === id && e.targetHandle === HANDLE.cropImageIn);
  const cX = edges.some((e) => e.target === id && e.targetHandle === HANDLE.cropX);
  const cY = edges.some((e) => e.target === id && e.targetHandle === HANDLE.cropY);
  const cW = edges.some((e) => e.target === id && e.targetHandle === HANDLE.cropW);
  const cH = edges.some((e) => e.target === id && e.targetHandle === HANDLE.cropH);

  const handleClass = "!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800";

  return (
    <div>
      <Handle id={HANDLE.cropImageIn} type="target" position={Position.Left} style={{ top: "14%" }} className={handleClass} />
      <Handle id={HANDLE.cropX} type="target" position={Position.Left} style={{ top: "30%" }} className={handleClass} />
      <Handle id={HANDLE.cropY} type="target" position={Position.Left} style={{ top: "46%" }} className={handleClass} />
      <Handle id={HANDLE.cropW} type="target" position={Position.Left} style={{ top: "62%" }} className={handleClass} />
      <Handle id={HANDLE.cropH} type="target" position={Position.Left} style={{ top: "78%" }} className={handleClass} />
      <NodeShell
        title="Crop image"
        icon={<Crop className="h-3.5 w-3.5 text-violet-400" />}
        selected={selected}
        running={running}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="X %" value={String(d.xPercent ?? 0)} disabled={cX} onChange={(v) => update(id, { xPercent: Number(v) || 0 })} />
          <Field label="Y %" value={String(d.yPercent ?? 0)} disabled={cY} onChange={(v) => update(id, { yPercent: Number(v) || 0 })} />
          <Field label="W %" value={String(d.widthPercent ?? 100)} disabled={cW} onChange={(v) => update(id, { widthPercent: Number(v) || 100 })} />
          <Field label="H %" value={String(d.heightPercent ?? 100)} disabled={cH} onChange={(v) => update(id, { heightPercent: Number(v) || 100 })} />
        </div>
        <label className="mt-1 block text-xs text-zinc-500">Image URL (if not wired)</label>
        <input
          title="Image URL"
          disabled={cImage}
          value={d.imageUrl ?? ""}
          onChange={(e) => update(id, { imageUrl: e.target.value })}
          className="w-full rounded-lg border px-2 py-1 text-xs outline-none transition
            border-zinc-200 bg-zinc-50 text-zinc-800 focus:border-violet-500/50 disabled:opacity-40
            dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200"
        />
      </NodeShell>
      <Handle
        id={HANDLE.cropOut}
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-violet-500/60 !bg-violet-600"
      />
    </div>
  );
}

function Field({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-zinc-500">
      {label}
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs outline-none transition
          border-zinc-200 bg-zinc-50 text-zinc-800 focus:border-violet-500/50 disabled:opacity-40
          dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200"
      />
    </label>
  );
}
