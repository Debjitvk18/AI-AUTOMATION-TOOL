"use client";

import type { NodeRun, RunScope, RunStatus, WorkflowRun } from "@prisma/client";
import { ChevronRight, History } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type RunWithNodes = WorkflowRun & { nodeRuns: NodeRun[] };

function badge(status: RunStatus) {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-400 ring-1 ring-red-500/30";
    case "PARTIAL":
      return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
    case "RUNNING":
    default:
      return "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30";
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

  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        const j = await res.json();
        if (!cancelled && res.ok) setRuns(j.runs as RunWithNodes[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workflowId, refreshKey]);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-800/80 bg-[var(--nf-panel)]">
      <div className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2">
        <History className="h-4 w-4 text-violet-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Workflow history
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {!workflowId ? (
          <p className="px-2 text-[11px] text-zinc-600">Save workflow to record runs.</p>
        ) : loading ? (
          <p className="px-2 text-[11px] text-zinc-500">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="px-2 text-[11px] text-zinc-600">No runs yet.</p>
        ) : (
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setExpanded((x) => (x === r.id ? null : r.id))}
                  className="flex w-full items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2 py-2 text-left transition hover:border-zinc-700"
                >
                  <ChevronRight
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 transition",
                      expanded === r.id && "rotate-90",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                          badge(r.status),
                        )}
                      >
                        {r.status}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(r.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{scopeLabel(r.scope)}</p>
                    {r.durationMs != null ? (
                      <p className="text-[10px] text-zinc-600">{r.durationMs} ms</p>
                    ) : null}
                  </div>
                </button>
                {expanded === r.id ? (
                  <div className="ml-6 mt-1 space-y-2 border-l border-zinc-800 pl-3">
                    {r.nodeRuns.map((nr) => (
                      <div key={nr.id} className="rounded-lg bg-zinc-950/50 p-2 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-300">
                            {nr.nodeType} <span className="text-zinc-600">({nr.nodeId})</span>
                          </span>
                          <span
                            className={cn(
                              "rounded px-1 text-[10px] uppercase",
                              nr.status === "SUCCESS" && "text-emerald-400",
                              nr.status === "FAILED" && "text-red-400",
                              nr.status === "RUNNING" && "text-amber-300",
                            )}
                          >
                            {nr.status}
                          </span>
                        </div>
                        {nr.durationMs != null ? (
                          <p className="text-[10px] text-zinc-600">{nr.durationMs} ms</p>
                        ) : null}
                        {nr.outputsJson ? (
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-zinc-500">
                            {JSON.stringify(nr.outputsJson, null, 0)}
                          </pre>
                        ) : null}
                        {nr.error ? (
                          <p className="mt-1 text-[10px] text-red-400">Error: {nr.error}</p>
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
    </aside>
  );
}
