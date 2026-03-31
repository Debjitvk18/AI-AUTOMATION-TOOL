"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Webhook, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function WebhookTriggerNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));
  const [copied, setCopied] = useState(false);

  const d = data as { hookId?: string; lastPayload?: string };

  // Generate a unique hook ID on first render if missing
  useEffect(() => {
    if (!d.hookId) {
      update(id, { hookId: nanoid(12) });
    }
  }, [d.hookId, id, update]);

  const webhookUrl = d.hookId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/trigger/${d.hookId}`
    : "Generating…";

  function copyUrl() {
    void navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-w-[260px] max-w-[380px]">
      <NodeShell title="Webhook Trigger" icon={<Webhook className="h-3.5 w-3.5 text-green-400" />} selected={selected} running={running}>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Webhook URL</label>
        <div className="flex items-center gap-1 mt-0.5">
          <input readOnly value={webhookUrl}
            className="flex-1 rounded-lg border px-2 py-1 text-xs outline-none
              border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400" />
          <button type="button" onClick={copyUrl} title="Copy URL"
            className="rounded-lg border p-1.5 text-zinc-400 transition hover:text-zinc-700
              border-zinc-200 dark:border-zinc-800 dark:hover:text-zinc-200">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Send a POST request to this URL. The body will be available as output when the workflow runs.
        </p>

        {d.lastPayload ? (
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg border p-2 text-xs whitespace-pre-wrap break-all
            border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
            {d.lastPayload}
          </pre>
        ) : (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">No payload received yet.</p>
        )}
      </NodeShell>
      <Handle id={HANDLE.webhookOut} type="source" position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-green-500/60 !bg-green-500" />
    </div>
  );
}
