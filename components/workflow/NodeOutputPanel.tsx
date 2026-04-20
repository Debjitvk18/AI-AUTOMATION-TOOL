"use client";

import { ChevronLeft, Loader2, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useWorkflowStore } from "@/store/workflow-store";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type NodeRunStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

type NodeRunData = {
  nodeId: string;
  nodeType: string;
  status: NodeRunStatus;
  durationMs: number | null;
  inputsJson: unknown;
  outputsJson: unknown;
  error: string | null;
};

type ActiveTab = "input" | "output" | "error";

// ─────────────────────────────────────────────────────────────
// Tiny collapsible JSON viewer  (no external lib)
// ─────────────────────────────────────────────────────────────
function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (value === null) return <span className="text-zinc-400">null</span>;
  if (value === undefined) return <span className="text-zinc-400">undefined</span>;
  if (typeof value === "boolean")
    return <span className="text-amber-500">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="text-sky-500">{value}</span>;
  if (typeof value === "string") {
    // Long strings get truncated with expand
    if (value.length > 200) {
      return (
        <ExpandableString value={value} />
      );
    }
    return <span className="text-emerald-600 dark:text-emerald-400">&quot;{value}&quot;</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-400">[]</span>;
    return (
      <span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-mono text-zinc-400 hover:text-violet-500"
        >
          {open ? "▾" : "▸"} [{value.length}]
        </button>
        {open ? (
          <div style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
            {value.map((item, i) => (
              <div key={i} className="flex gap-1">
                <span className="shrink-0 text-zinc-400">{i}:</span>
                <JsonValue value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        ) : null}
      </span>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-zinc-400">{"{}"}</span>;
    return (
      <span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-mono text-zinc-400 hover:text-violet-500"
        >
          {open ? "▾" : "▸"} {"{"}
          {entries.length}
          {"}"}
        </button>
        {open ? (
          <div style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-1 flex-wrap">
                <span className="shrink-0 text-violet-500 dark:text-violet-400 font-medium">
                  {k}:
                </span>
                <JsonValue value={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        ) : null}
      </span>
    );
  }
  return <span className="text-zinc-400">{String(value)}</span>;
}

function ExpandableString({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? value : value.slice(0, 200) + "…";
  return (
    <span>
      <span className="text-emerald-600 dark:text-emerald-400 whitespace-pre-wrap break-all">
        &quot;{display}&quot;
      </span>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="ml-1 text-xs text-violet-500 hover:underline"
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: NodeRunStatus }) {
  const cls = {
    SUCCESS: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400",
    FAILED: "bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400",
    RUNNING: "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300",
    PENDING: "bg-zinc-500/15 text-zinc-500 ring-zinc-400/30",
    SKIPPED: "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300",
  }[status];
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium uppercase ring-1", cls)}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────
export function NodeOutputPanel({ workflowId }: { workflowId: string | null }) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const [nodeRun, setNodeRun] = useState<NodeRunData | null>(null);
  const [loading, setLoading] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("output");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived: selected node type label
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeTypeLabel = selectedNode?.type ?? "Node";

  // ── Fetch latest NodeRun for selected node ──
  const fetchNodeRun = useCallback(
    async (quiet = false) => {
      if (!workflowId || !selectedNodeId) return;
      if (!quiet) setLoading(true);
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        const j = (await res.json().catch(() => null)) as {
          runs?: Array<{
            id: string;
            status: string;
            nodeRuns: Array<{
              nodeId: string;
              nodeType: string;
              status: NodeRunStatus;
              durationMs: number | null;
              inputsJson: unknown;
              outputsJson: unknown;
              error: string | null;
            }>;
          }>;
        } | null;
        if (!res.ok || !j?.runs?.length) {
          setNodeRun(null);
          return;
        }
        // latest run that includes this nodeId
        const latestRun = j.runs.find((r) =>
          r.nodeRuns.some((nr) => nr.nodeId === selectedNodeId),
        );
        if (!latestRun) {
          setNodeRun(null);
          return;
        }
        const nr = latestRun.nodeRuns.find((nr) => nr.nodeId === selectedNodeId);
        if (!nr) {
          setNodeRun(null);
          return;
        }
        setNodeRun({
          nodeId: nr.nodeId,
          nodeType: nr.nodeType,
          status: nr.status,
          durationMs: nr.durationMs,
          inputsJson: nr.inputsJson,
          outputsJson: nr.outputsJson,
          error: nr.error,
        });
        // Stop polling when done
        if (nr.status !== "RUNNING" && nr.status !== "PENDING") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [workflowId, selectedNodeId],
  );

  // Fetch on selection change + start/stop poll
  useEffect(() => {
    if (!selectedNodeId) {
      setNodeRun(null);
      return;
    }
    void fetchNodeRun(false);

    // Poll while potentially running
    pollRef.current = setInterval(() => {
      void fetchNodeRun(true);
    }, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [selectedNodeId, fetchNodeRun]);

  // ── Run single node ──
  const handleRunNode = useCallback(async () => {
    if (!workflowId || !selectedNodeId) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graphJson: { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } },
          scope: "SINGLE",
          targetNodeIds: [selectedNodeId],
        }),
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(j?.error ?? "Run failed");

      // Start polling immediately
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        void fetchNodeRun(true);
      }, 1500);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunBusy(false);
    }
  }, [workflowId, selectedNodeId, nodes, edges, fetchNodeRun]);

  // ── Don't render if nothing selected ──
  if (!selectedNodeId) return null;

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "output", label: "Output" },
    { key: "input", label: "Input" },
    { key: "error", label: "Error" },
  ];

  const tabContent: Record<ActiveTab, unknown> = {
    input: nodeRun?.inputsJson,
    output: nodeRun?.outputsJson,
    error: nodeRun?.error ?? null,
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-200 bg-[var(--nf-panel)] dark:border-zinc-800/80">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={() => setSelectedNodeId(null)}
          title="Close panel"
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--nf-text)]">
            {nodeTypeLabel}
          </p>
          <p className="truncate text-[10px] text-zinc-400">
            {selectedNodeId.slice(0, 10)}…
          </p>
        </div>
        {nodeRun ? <StatusBadge status={nodeRun.status} /> : null}
        <button
          type="button"
          onClick={() => setSelectedNodeId(null)}
          className="ml-auto rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Duration */}
      {nodeRun?.durationMs != null ? (
        <div className="border-b border-zinc-100 px-3 py-1 dark:border-zinc-800/60">
          <span className="text-[11px] text-zinc-400">
            Duration: {nodeRun.durationMs} ms
          </span>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800/80">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition",
              activeTab === t.key
                ? "border-b-2 border-violet-500 text-violet-600 dark:text-violet-400"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {t.label}
            {t.key === "error" && nodeRun?.error ? (
              <span className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
                !
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : !nodeRun ? (
          <div className="space-y-1">
            <p className="text-xs text-zinc-400">No execution data yet.</p>
            <p className="text-[11px] text-zinc-300 dark:text-zinc-600">
              Run the workflow or use the &quot;Run Node&quot; button below.
            </p>
          </div>
        ) : activeTab === "error" ? (
          nodeRun.error ? (
            <pre className="whitespace-pre-wrap break-all rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {nodeRun.error}
            </pre>
          ) : (
            <p className="text-xs text-zinc-400">No error.</p>
          )
        ) : tabContent[activeTab] != null ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-950/50">
            <JsonValue value={tabContent[activeTab]} depth={0} />
          </div>
        ) : (
          <p className="text-xs text-zinc-400">
            {nodeRun.status === "SKIPPED"
              ? "Node was skipped (upstream failure)."
              : "No data available for this tab."}
          </p>
        )}
      </div>

      {/* Run Node button */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800/80">
        <button
          type="button"
          disabled={runBusy || !workflowId}
          onClick={() => void handleRunNode()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {runBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run Node
        </button>
        {runError ? (
          <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{runError}</p>
        ) : null}
      </div>
    </aside>
  );
}
