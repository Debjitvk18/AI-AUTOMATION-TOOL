"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

const OPERATORS = [
  { id: "equals", label: "Equals" },
  { id: "notEquals", label: "Not Equals" },
  { id: "contains", label: "Contains" },
  { id: "notContains", label: "Not Contains" },
  { id: "gt", label: "Greater Than" },
  { id: "lt", label: "Less Than" },
  { id: "isEmpty", label: "Is Empty" },
  { id: "isNotEmpty", label: "Is Not Empty" },
] as const;

export function IfElseNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));

  const d = data as { field?: string; operator?: string; value?: string; lastResult?: string };

  const inputCls = `w-full rounded-lg border px-2 py-1 text-sm outline-none transition
    border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50
    dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600`;

  return (
    <div className="min-w-[260px] max-w-[360px]">
      <Handle id={HANDLE.conditionIn} type="target" position={Position.Left} style={{ top: "50%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800" />
      <NodeShell title="If / Else" icon={<GitBranch className="h-3.5 w-3.5 text-yellow-400" />} selected={selected} running={running}>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Field / Key</label>
        <input value={d.field ?? ""} onChange={(e) => update(id, { field: e.target.value })}
          placeholder="e.g. status, data.count" className={inputCls} />

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Operator</label>
        <select title="Operator" value={d.operator ?? "equals"} onChange={(e) => update(id, { operator: e.target.value })} className={inputCls}>
          {OPERATORS.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
        </select>

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Value</label>
        <input value={d.value ?? ""} onChange={(e) => update(id, { value: e.target.value })}
          placeholder="Compare against…" className={inputCls} />

        {d.lastResult ? (
          <div className="mt-2 rounded-lg border p-2 text-xs
            border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
            Last: <strong>{d.lastResult}</strong>
          </div>
        ) : null}
      </NodeShell>
      <Handle id={HANDLE.trueOut} type="source" position={Position.Right} style={{ top: "35%" }}
        className="!h-2.5 !w-2.5 !border !border-emerald-500/60 !bg-emerald-500" title="True" />
      <Handle id={HANDLE.falseOut} type="source" position={Position.Right} style={{ top: "65%" }}
        className="!h-2.5 !w-2.5 !border !border-red-500/60 !bg-red-500" title="False" />
    </div>
  );
}
