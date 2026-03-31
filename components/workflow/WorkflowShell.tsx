"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { UserButton } from "@clerk/nextjs";
import {
  ChevronDown,
  Download,
  Loader2,
  Play,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "../ThemeToggle";
import { LeftSidebar } from "./LeftSidebar";
import { RightHistoryPanel } from "./RightHistoryPanel";
import { WorkflowCanvas } from "./WorkflowCanvas";

type WorkflowListItem = { id: string; name: string };

export function WorkflowShell({
  onSave,
  onRunFull,
  onRunSelected,
  onDelete,
  onNewWorkflow,
  onSwitchWorkflow,
  onRenameWorkflow,
  allWorkflows,
  saving,
  running,
  workflowId,
  historyKey,
}: {
  onSave: () => Promise<void>;
  onRunFull: () => Promise<void>;
  onRunSelected: () => Promise<void>;
  onDelete: () => Promise<void>;
  onNewWorkflow: () => Promise<void>;
  onSwitchWorkflow: (id: string) => Promise<void>;
  onRenameWorkflow: (newName: string) => Promise<void>;
  allWorkflows: WorkflowListItem[];
  saving: boolean;
  running: boolean;
  workflowId: string | null;
  historyKey: number;
}) {
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const name = useWorkflowStore((s) => s.workflowName);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        {/* Left side: logo + workflow selector */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">NextFlow</span>

          {/* Editable workflow name */}
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                if (nameInput.trim() && nameInput.trim() !== name) {
                  void onRenameWorkflow(nameInput.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setEditingName(false);
                }
              }}
              className="max-w-[160px] rounded-lg border px-2 py-0.5 text-xs font-medium outline-none transition
                border-violet-400 bg-white text-zinc-800 focus:ring-2 focus:ring-violet-500/30
                dark:border-violet-600 dark:bg-zinc-950 dark:text-zinc-200"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameInput(name);
                setEditingName(true);
                setTimeout(() => nameInputRef.current?.select(), 50);
              }}
              className="max-w-[160px] truncate rounded-lg px-2 py-0.5 text-xs text-zinc-500 transition
                hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              title="Click to rename"
            >
              {name}
            </button>
          )}

          {/* Workflow selector dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="inline-flex min-w-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs transition
                border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-400
                dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:border-zinc-600"
            >
              <ChevronDown className={cn("h-3 w-3 shrink-0 transition", dropdownOpen && "rotate-180")} />
            </button>

            {dropdownOpen ? (
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border shadow-lg
                border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className="max-h-52 overflow-y-auto p-1">
                  {allWorkflows.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        void onSwitchWorkflow(w.id);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition",
                        w.id === workflowId
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                      )}
                    >
                      <span className="truncate">{w.name}</span>
                      {w.id === workflowId ? (
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-violet-400">active</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <div className="border-t border-zinc-200 p-1 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      void onNewWorkflow();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-emerald-600 transition
                      hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New workflow
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Quick "+" button visible always */}
          <button
            type="button"
            onClick={() => void onNewWorkflow()}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-emerald-50 hover:text-emerald-600
              dark:text-zinc-500 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
            title="Create new workflow"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Right side: actions */}
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
          {/* Delete Workflow */}
          <button
            type="button"
            disabled={!workflowId}
            onClick={() => void onDelete()}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            title="Delete workflow"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
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
