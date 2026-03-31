"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Clock } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

const PRESETS = [
  { cron: "* * * * *", label: "Every minute" },
  { cron: "*/5 * * * *", label: "Every 5 minutes" },
  { cron: "*/15 * * * *", label: "Every 15 minutes" },
  { cron: "0 * * * *", label: "Every hour" },
  { cron: "0 */6 * * *", label: "Every 6 hours" },
  { cron: "0 0 * * *", label: "Daily at midnight" },
  { cron: "0 9 * * 1-5", label: "Weekdays at 9 AM" },
  { cron: "0 0 * * 0", label: "Weekly (Sunday)" },
] as const;

export function ScheduleTriggerNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));

  const d = data as { cron?: string; description?: string; lastRun?: string };
  const selectedPreset = PRESETS.find((p) => p.cron === d.cron);

  const inputCls = `w-full rounded-lg border px-2 py-1 text-sm outline-none transition
    border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50
    dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600`;

  return (
    <div className="min-w-[240px] max-w-[340px]">
      <NodeShell title="Schedule Trigger" icon={<Clock className="h-3.5 w-3.5 text-blue-400" />} selected={selected} running={running}>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Schedule Preset</label>
        <select title="Schedule" value={d.cron ?? "0 * * * *"}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.cron === e.target.value);
            update(id, { cron: e.target.value, description: p?.label ?? "Custom" });
          }} className={inputCls}>
          {PRESETS.map((p) => <option key={p.cron} value={p.cron}>{p.label}</option>)}
        </select>

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Cron Expression</label>
        <input value={d.cron ?? ""} onChange={(e) => update(id, { cron: e.target.value, description: "Custom" })}
          placeholder="0 * * * *" className={inputCls} />

        <div className="mt-2 rounded-lg border p-2 text-xs text-center
          border-zinc-200 bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <span className="text-zinc-600 dark:text-zinc-400">
            🕐 {selectedPreset?.label ?? d.description ?? "Custom schedule"}
          </span>
        </div>

        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          When triggered manually, outputs the current timestamp.
        </p>

        {d.lastRun ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">Last: {d.lastRun}</p>
        ) : null}
      </NodeShell>
      <Handle id={HANDLE.scheduleOut} type="source" position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-blue-500/60 !bg-blue-500" />
    </div>
  );
}
