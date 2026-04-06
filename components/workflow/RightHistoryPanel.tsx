"use client";

import type { NodeRun, RunScope, RunStatus, WorkflowRun } from "@prisma/client";
import { ChevronLeft, ChevronRight, History, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type RunWithNodes = WorkflowRun & { nodeRuns: NodeRun[] };

function badge(status: RunStatus) {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400";
    case "FAILED":
      return "bg-red-500/15 text-red-600 ring-1 ring-red-500/30 dark:text-red-400";
    case "PARTIAL":
      return "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-300";
    case "RUNNING":
    default:
      return "bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30 dark:text-violet-300";
  }
}

function scopeLabel(s: RunScope) {
  switch (s) {
    case "FULL":
      return "Full workflow";
    case "PARTIAL":
      return "Selected nodes";
    case "SINGLE":
      return "Single node";
    default:
      return s;
  }
}

export function RightHistoryPanel({
  workflowId,
  refreshKey,
}: {
  workflowId: string | null;
  refreshKey: number;
}) {
  const [runs, setRuns] = useState<RunWithNodes[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchRuns = useCallback(async (showLoading = true) => {
    if (!workflowId) return;
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      const j = await res.json();
      if (res.ok) setRuns(j.runs as RunWithNodes[]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void fetchRuns(true);
  }, [fetchRuns, refreshKey]);

  useEffect(() => {
    if (!workflowId) return;
    const hasRunning = runs.some((r) => r.status === "RUNNING");
    if (!hasRunning) return;

    const id = window.setInterval(() => {
      void fetchRuns(false);
    }, 2000);

    return () => window.clearInterval(id);
  }, [workflowId, runs, fetchRuns]);

  const deleteRun = useCallback(async (runId: string) => {
    if (!workflowId) return;
    setDeletingId(runId);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs/${runId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRuns((prev) => prev.filter((r) => r.id !== runId));
        if (expanded === runId) setExpanded(null);
        console.log(`[NextFlow] Deleted run ${runId}`);
      } else {
        console.error("[NextFlow] Failed to delete run");
      }
    } finally {
      setDeletingId(null);
    }
  }, [workflowId, expanded]);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-l bg-(--nf-panel) transition-[width]",
        "border-zinc-200 dark:border-zinc-800/80",
        collapsed ? "w-12" : "w-80",
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2
        border-zinc-200 dark:border-zinc-800/80">
        <History className="h-4 w-4 text-violet-500 dark:text-violet-400" />
        {!collapsed ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Workflow history
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700
            dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          aria-label={collapsed ? "Expand history sidebar" : "Collapse history sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {collapsed ? (
        <div className="flex flex-1 items-center justify-center p-1 text-[10px] text-zinc-500 dark:text-zinc-500 [writing-mode:vertical-rl]">
          History
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto p-2">
        {!workflowId ? (
          <p className="px-2 text-xs text-zinc-400 dark:text-zinc-600">Save workflow to record runs.</p>
        ) : loading ? (
          <p className="px-2 text-xs text-zinc-500">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="px-2 text-xs text-zinc-400 dark:text-zinc-600">No runs yet.</p>
        ) : (
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.id}>
                <div className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => setExpanded((x) => (x === r.id ? null : r.id))}
                    className="flex flex-1 items-start gap-2 rounded-lg border px-2 py-2 text-left transition
                      border-zinc-200 bg-white/60 hover:border-zinc-300
                      dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
                  >
                    <ChevronRight
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 transition dark:text-zinc-600",
                        expanded === r.id && "rotate-90",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs font-medium uppercase",
                            badge(r.status),
                          )}
                        >
                          {r.status}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(r.startedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{scopeLabel(r.scope)}</p>
                      {r.durationMs != null ? (
                        <p className="text-xs text-zinc-400 dark:text-zinc-600">{r.durationMs} ms</p>
                      ) : null}
                    </div>
                  </button>
                  {/* Delete run button */}
                  <button
                    type="button"
                    disabled={deletingId === r.id}
                    onClick={() => void deleteRun(r.id)}
                    className="mt-1 shrink-0 rounded-lg p-1.5 text-zinc-300 transition
                      hover:bg-red-50 hover:text-red-500
                      dark:text-zinc-700 dark:hover:bg-red-950/30 dark:hover:text-red-400
                      disabled:opacity-40"
                    title="Delete run"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {expanded === r.id ? (
                  <div className="ml-6 mt-1 space-y-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
                    {r.nodeRuns.map((nr) => (
                      <div key={nr.id} className="rounded-lg p-2 text-xs
                        bg-zinc-50 dark:bg-zinc-950/50">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {nr.nodeType} <span className="text-zinc-400 dark:text-zinc-600">({nr.nodeId.slice(0, 8)}…)</span>
                          </span>
                          <span
                            className={cn(
                              "rounded px-1 text-xs uppercase",
                              nr.status === "SUCCESS" && "text-emerald-600 dark:text-emerald-400",
                              nr.status === "FAILED" && "text-red-600 dark:text-red-400",
                              nr.status === "RUNNING" && "text-amber-600 dark:text-amber-300",
                              nr.status === "PENDING" && "text-zinc-400 dark:text-zinc-600",
                            )}
                          >
                            {nr.status}
                          </span>
                        </div>
                        {nr.durationMs != null ? (
                          <p className="text-xs text-zinc-400 dark:text-zinc-600">{nr.durationMs} ms</p>
                        ) : null}
                        {nr.outputsJson ? (
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-500">
                            {JSON.stringify(nr.outputsJson, null, 0)}
                          </pre>
                        ) : null}
                        {nr.error ? (
                          <p className="mt-1 text-xs text-red-500 dark:text-red-400">Error: {nr.error}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
    </aside>
  );
}
