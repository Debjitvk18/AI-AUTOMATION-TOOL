"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Bell } from "lucide-react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

const NOTIF_TYPES = [
  { id: "webhook", label: "Webhook (POST)" },
  { id: "console", label: "Console Log" },
] as const;

export function NotificationNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));

  const d = data as { notifType?: string; webhookUrl?: string; message?: string; lastStatus?: string };

  const inputCls = `w-full rounded-lg border px-2 py-1 text-sm outline-none transition
    border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50
    dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600`;

  return (
    <div className="min-w-[260px] max-w-[380px]">
      <Handle id={HANDLE.notificationIn} type="target" position={Position.Left} style={{ top: "50%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800" />
      <NodeShell title="Send Notification" icon={<Bell className="h-3.5 w-3.5 text-pink-400" />} selected={selected} running={running}>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Type</label>
        <select title="Notification Type" value={d.notifType ?? "webhook"} onChange={(e) => update(id, { notifType: e.target.value })} className={inputCls}>
          {NOTIF_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        {d.notifType === "webhook" ? (
          <>
            <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Webhook URL</label>
            <input value={d.webhookUrl ?? ""} onChange={(e) => update(id, { webhookUrl: e.target.value })}
              placeholder="https://hooks.slack.com/…" className={inputCls} />
          </>
        ) : null}

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Message template <span className="normal-case font-normal">(use {"{{input}}"} for upstream data)</span>
        </label>
        <textarea value={d.message ?? ""} onChange={(e) => update(id, { message: e.target.value })}
          placeholder="Workflow completed! Result: {{input}}" className={`min-h-[52px] resize-y ${inputCls}`} />

        {d.lastStatus ? (
          <div className="mt-2 rounded-lg border p-2 text-xs
            border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
            Status: {d.lastStatus}
          </div>
        ) : null}
      </NodeShell>
      <Handle id={HANDLE.notificationOut} type="source" position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-pink-500/60 !bg-pink-500" />
    </div>
  );
}
