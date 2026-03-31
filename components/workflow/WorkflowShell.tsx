"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { UserButton } from "@clerk/nextjs";
import {
  Download,
  Loader2,
  Play,
  Redo2,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { ThemeToggle } from "../ThemeToggle";
import { LeftSidebar } from "./LeftSidebar";
import { RightHistoryPanel } from "./RightHistoryPanel";
import { WorkflowCanvas } from "./WorkflowCanvas";

export function WorkflowShell({
  onSave,
  onRunFull,
  onRunSelected,
  saving,
  running,
  workflowId,
  historyKey,
}: {
  onSave: () => Promise<void>;
  onRunFull: () => Promise<void>;
  onRunSelected: () => Promise<void>;
  saving: boolean;
  running: boolean;
  workflowId: string | null;
  historyKey: number;
}) {
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const name = useWorkflowStore((s) => s.workflowName);

  const exportJson = useCallback(async () => {
    if (!workflowId) return;
    const res = await fetch(`/api/workflows/${workflowId}/export`);
    const data = await res.json();
    if (!res.ok) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nextflow-${workflowId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [workflowId]);

  const [importing, setImporting] = useState(false);

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[var(--nf-bg)] text-zinc-800 dark:text-zinc-200">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-3 dark:border-zinc-800/80">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">NextFlow</span>
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-500">{name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void undo()}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void redo()}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={saving || !workflowId}
            onClick={() => void onSave()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40
              border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-400
              dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:hover:border-zinc-600"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            type="button"
            disabled={running || !workflowId}
            onClick={() => void onRunFull()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run all
          </button>
          <button
            type="button"
            disabled={running || !workflowId}
            onClick={() => void onRunSelected()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-100/60 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-40
              dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/70"
          >
            Run selected
          </button>
          <button
            type="button"
            disabled={!workflowId}
            onClick={() => void exportJson()}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            title="Export JSON"
          >
            <Download className="h-4 w-4" />
          </button>
          <label className="cursor-pointer rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100">
            <Upload className="h-4 w-4" />
            <input
              title="Import JSON"
              type="file"
              accept="application/json"
              className="hidden"
              disabled={importing || !workflowId}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !workflowId) return;
                setImporting(true);
                try {
                  const text = await f.text();
                  const parsed = JSON.parse(text) as { graphJson?: unknown; name?: string };
                  await fetch(`/api/workflows/${workflowId}/import`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      graphJson: parsed.graphJson,
                      name: parsed.name,
                    }),
                  });
                  window.location.reload();
                } finally {
                  setImporting(false);
                }
              }}
            />
          </label>
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        <div className="relative min-h-0 min-w-0 flex-1">
          <ReactFlowProvider>
            <WorkflowCanvas />
          </ReactFlowProvider>
        </div>
        <RightHistoryPanel workflowId={workflowId} refreshKey={historyKey} />
      </div>
    </div>
  );
}
