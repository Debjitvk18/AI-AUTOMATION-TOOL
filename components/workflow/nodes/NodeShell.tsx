"use client";

import { useNodeId } from "@xyflow/react";
import { ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useWorkflowStore } from "@/store/workflow-store";
import { parseRetryPolicy, type RetryBackoffType } from "@/lib/retry";

// Status dot colors matching execution status
function StatusDot({ status }: { status: string | undefined }) {
  if (!status) return null;
  const cls = {
    SUCCESS: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]",
    FAILED: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]",
    RUNNING: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)] animate-pulse",
    PENDING: "bg-zinc-400",
    SKIPPED: "bg-zinc-300 dark:bg-zinc-600",
  }[status] ?? "bg-zinc-400";

  return (
    <span
      title={`Last run: ${status}`}
      className={cn("ml-auto h-2 w-2 shrink-0 rounded-full", cls)}
    />
  );
}

export function NodeShell({
  title,
  icon,
  selected,
  running,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  selected?: boolean;
  running?: boolean;
  children: React.ReactNode;
}) {
  const nodeId = useNodeId();
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const nodeRunStatuses = useWorkflowStore((s) => s.nodeRunStatuses);
  const [retryOpen, setRetryOpen] = useState(false);

  const policy = node ? parseRetryPolicy(node.data) : null;
  const lastStatus = nodeId ? nodeRunStatuses[nodeId] : undefined;

  // Extra ring based on last execution status
  const statusRing =
    lastStatus === "SUCCESS"
      ? "ring-1 ring-emerald-500/50 border-emerald-500/40"
      : lastStatus === "FAILED"
        ? "ring-1 ring-red-500/50 border-red-500/40"
        : "";

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-xl border shadow-xl backdrop-blur",
        "bg-white/95 dark:bg-zinc-950/90",
        "border-zinc-200 dark:border-zinc-800/90",
        selected && "border-violet-500/70 ring-1 ring-violet-500/40",
        running && "nf-node-running border-violet-400/60",
        // Only apply status ring when not already highlighted by selected/running
        !selected && !running && statusRing,
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800/80">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          {title}
        </span>
        {/* Status dot — driven by nodeRunStatuses from the store */}
        <StatusDot status={lastStatus} />
      </div>
      <div className="space-y-2 p-3 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>

      {/* Retry Policy Config */}
      {policy && nodeId ? (
        <div className="border-t border-zinc-200 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setRetryOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/50 rounded-b-xl"
          >
            <div className="flex items-center gap-1.5">
              <Settings2 className="h-3 w-3" />
              <span>Retry Policy {policy.enabled ? `<${policy.maxAttempts}x>` : ""}</span>
            </div>
            <ChevronDown className={cn("h-3 w-3 transition", retryOpen && "rotate-180")} />
          </button>

          {retryOpen ? (
            <div className="space-y-3 p-3 pt-1 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policy.enabled}
                  onChange={(e) => updateNodeData(nodeId, { retryPolicy: { ...policy, enabled: e.target.checked } })}
                  className="rounded border-zinc-300 text-violet-600 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <span className="text-zinc-700 dark:text-zinc-300">Enable Retries</span>
              </label>

              {policy.enabled ? (
                <>
                  <div className="space-y-1">
                    <label className="text-zinc-500 dark:text-zinc-400">Max Attempts (1-10)</label>
                    <input
                      title="input"
                      type="number"
                      min="1" max="10"
                      value={policy.maxAttempts}
                      onChange={(e) => updateNodeData(nodeId, { retryPolicy: { ...policy, maxAttempts: Number(e.target.value) } })}
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 dark:text-zinc-400">Backoff Type</label>
                    <select
                      title="input"
                      value={policy.backoffType}
                      onChange={(e) => updateNodeData(nodeId, { retryPolicy: { ...policy, backoffType: e.target.value as RetryBackoffType } })}
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="none">None</option>
                      <option value="fixed">Fixed Delay</option>
                      <option value="exponential">Exponential</option>
                    </select>
                  </div>

                  {policy.backoffType !== "none" ? (
                    <div className="space-y-1">
                      <label className="text-zinc-500 dark:text-zinc-400">Initial Delay (ms)</label>
                      <input
                        title="input"
                        type="number"
                        min="100" step="100"
                        value={policy.initialDelayMs}
                        onChange={(e) => updateNodeData(nodeId, { retryPolicy: { ...policy, initialDelayMs: Number(e.target.value) } })}
                        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <label className="text-zinc-500 dark:text-zinc-400">Retryable Errors (comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. timeout, rate limit (empty = all)"
                      value={policy.retryableErrors}
                      onChange={(e) => updateNodeData(nodeId, { retryPolicy: { ...policy, retryableErrors: e.target.value } })}
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
