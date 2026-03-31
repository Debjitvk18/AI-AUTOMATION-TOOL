"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Shuffle } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

const OPERATIONS = [
  { id: "jsonParse", label: "JSON Parse" },
  { id: "jsonStringify", label: "JSON Stringify" },
  { id: "uppercase", label: "Uppercase" },
  { id: "lowercase", label: "Lowercase" },
  { id: "trim", label: "Trim" },
  { id: "template", label: "Template (use {{input}})" },
  { id: "extractField", label: "Extract JSON Field" },
  { id: "base64Encode", label: "Base64 Encode" },
  { id: "base64Decode", label: "Base64 Decode" },
] as const;

export function DataTransformNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));

  const d = data as { operation?: string; template?: string; lastOutput?: string };

  const inputCls = `w-full rounded-lg border px-2 py-1 text-sm outline-none transition
    border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50
    dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600`;

  const showTemplate = d.operation === "template" || d.operation === "extractField";

  return (
    <div className="min-w-[260px] max-w-[360px]">
      <Handle id={HANDLE.transformIn} type="target" position={Position.Left} style={{ top: "50%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800" />
      <NodeShell title="Data Transform" icon={<Shuffle className="h-3.5 w-3.5 text-cyan-400" />} selected={selected} running={running}>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Operation</label>
        <select title="Operation" value={d.operation ?? "jsonParse"} onChange={(e) => update(id, { operation: e.target.value })} className={inputCls}>
          {OPERATIONS.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
        </select>

        {showTemplate ? (
          <>
            <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              {d.operation === "extractField" ? "Field path (e.g. data.name)" : "Template"}
            </label>
            <textarea value={d.template ?? ""} onChange={(e) => update(id, { template: e.target.value })}
              placeholder={d.operation === "extractField" ? "data.items[0].name" : "Result: {{input}}"}
              className={`min-h-[48px] resize-y ${inputCls}`} />
          </>
        ) : null}

        {d.lastOutput ? (
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg border p-2 text-xs whitespace-pre-wrap break-all
            border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
            {d.lastOutput}
          </pre>
        ) : null}
      </NodeShell>
      <Handle id={HANDLE.transformOut} type="source" position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-cyan-500/60 !bg-cyan-500" />
    </div>
  );
}
