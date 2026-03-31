"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { WorkflowShell } from "./WorkflowShell";

type WorkflowListItem = { id: string; name: string };

export function WorkflowPageClient() {
  const setWorkflowMeta = useWorkflowStore((s) => s.setWorkflowMeta);
  const setGraph = useWorkflowStore((s) => s.setGraph);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const workflowId = useWorkflowStore((s) => s.workflowId);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [allWorkflows, setAllWorkflows] = useState<WorkflowListItem[]>([]);

  // --- Fetch all workflows list ---
  const refreshWorkflowList = useCallback(async () => {
    const res = await fetch("/api/workflows");
    const j = await res.json();
    if (res.ok) {
      setAllWorkflows(j.workflows as WorkflowListItem[]);
    }
    return j.workflows as WorkflowListItem[];
  }, []);

  // --- Load a specific workflow by ID ---
  const loadWorkflow = useCallback(async (id: string) => {
    console.log(`[NextFlow] Loading workflow: ${id}`);
    const gr = await fetch(`/api/workflows/${id}`);
    const gj = await gr.json();
    if (!gr.ok) {
      console.error("[NextFlow] Failed to load workflow", gj);
      return;
    }
    const wf = gj.workflow as { id: string; name: string; graphJson: { nodes: unknown[]; edges: unknown[] } };
    setWorkflowMeta(wf.id, wf.name);
    setGraph(wf.graphJson.nodes as never[], wf.graphJson.edges as never[]);
    setHistoryKey((k) => k + 1);
    console.log(`[NextFlow] Loaded ${(wf.graphJson.nodes ?? []).length} nodes, ${(wf.graphJson.edges ?? []).length} edges`);
  }, [setGraph, setWorkflowMeta]);

  // --- Bootstrap: load first workflow or create empty ---
  const bootstrap = useCallback(async () => {
    console.log("[NextFlow] Bootstrapping…");
    const workflows = await refreshWorkflowList();
    if (workflows.length > 0) {
      await loadWorkflow(workflows[0]!.id);
      return;
    }
    // Create an empty workflow
    console.log("[NextFlow] No workflows found, creating empty…");
    const cr = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Untitled workflow",
        graphJson: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      }),
    });
    const cj = await cr.json();
    if (!cr.ok) {
      console.error("[NextFlow] Failed to create workflow", cj);
      return;
    }
    const created = cj.workflow as WorkflowListItem;
    setWorkflowMeta(created.id, created.name);
    setGraph([], []);
    setAllWorkflows([created]);
  }, [refreshWorkflowList, loadWorkflow, setGraph, setWorkflowMeta]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // --- Save current workflow ---
  const save = useCallback(async () => {
    if (!workflowId) return;
    console.log(`[NextFlow] Saving ${workflowId}`);
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graphJson: { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } },
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        console.error("[NextFlow] Save failed:", j);
      }
    } finally {
      setSaving(false);
    }
  }, [edges, nodes, workflowId]);

  // --- Run workflow ---
  const run = useCallback(
    async (scope: "FULL" | "PARTIAL" | "SINGLE", targetNodeIds?: string[]) => {
      if (!workflowId) return;
      console.log(`[NextFlow] Run — scope: ${scope}`);
      setRunning(true);
      try {
        await save();
        const res = await fetch(`/api/workflows/${workflowId}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graphJson: { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } },
            scope,
            targetNodeIds,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Run failed");
        console.log(`[NextFlow] Run created: ${j.runId}`);
        setHistoryKey((k) => k + 1);
      } finally {
        setRunning(false);
      }
    },
    [edges, nodes, save, workflowId],
  );

  const onRunFull = useCallback(() => run("FULL"), [run]);

  const onRunSelected = useCallback(async () => {
    const selected = nodes.filter((n) => n.selected).map((n) => n.id);
    if (selected.length === 0) return;
    if (selected.length === 1) await run("SINGLE", selected);
    else await run("PARTIAL", selected);
  }, [nodes, run]);

  // --- Create a NEW workflow ---
  const onNewWorkflow = useCallback(async () => {
    // Save current workflow first
    if (workflowId) await save();

    console.log("[NextFlow] Creating new workflow…");
    const cr = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Untitled workflow",
        graphJson: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      }),
    });
    const cj = await cr.json();
    if (!cr.ok) {
      console.error("[NextFlow] Create failed:", cj);
      return;
    }
    const created = cj.workflow as WorkflowListItem;
    setWorkflowMeta(created.id, created.name);
    setGraph([], []);
    setHistoryKey((k) => k + 1);
    // Refresh the dropdown list
    await refreshWorkflowList();
    console.log(`[NextFlow] New workflow: ${created.id}`);
  }, [workflowId, save, setWorkflowMeta, setGraph, refreshWorkflowList]);

  // --- Switch to a different workflow ---
  const onSwitchWorkflow = useCallback(async (id: string) => {
    if (id === workflowId) return;
    // Save current before switching
    if (workflowId) await save();
    await loadWorkflow(id);
  }, [workflowId, save, loadWorkflow]);

  // --- Delete current workflow ---
  const onDelete = useCallback(async () => {
    if (!workflowId) return;
    const confirmed = window.confirm("Delete this workflow? This action cannot be undone.");
    if (!confirmed) return;
    console.log(`[NextFlow] Deleting ${workflowId}`);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" });
      if (!res.ok) {
        console.error("[NextFlow] Delete failed");
        return;
      }
      // Refresh list and load another, or create new
      const remaining = await refreshWorkflowList();
      const filtered = remaining.filter((w: WorkflowListItem) => w.id !== workflowId);
      if (filtered.length > 0) {
        await loadWorkflow(filtered[0]!.id);
      } else {
        // No workflows left, create new
        await onNewWorkflow();
      }
    } catch (e) {
      console.error("[NextFlow] Delete error:", e);
    }
  }, [workflowId, refreshWorkflowList, loadWorkflow, onNewWorkflow]);

  // --- Rename workflow ---
  const onRenameWorkflow = useCallback(async (newName: string) => {
    if (!workflowId || !newName.trim()) return;
    const trimmed = newName.trim();
    console.log(`[NextFlow] Renaming to "${trimmed}"`);
    setWorkflowMeta(workflowId, trimmed);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      await refreshWorkflowList();
    } catch (e) {
      console.error("[NextFlow] Rename error:", e);
    }
  }, [workflowId, setWorkflowMeta, refreshWorkflowList]);

  return (
    <WorkflowShell
      onSave={save}
      onRunFull={onRunFull}
      onRunSelected={onRunSelected}
      onDelete={onDelete}
      onNewWorkflow={onNewWorkflow}
      onSwitchWorkflow={onSwitchWorkflow}
      onRenameWorkflow={onRenameWorkflow}
      allWorkflows={allWorkflows}
      saving={saving}
      running={running}
      workflowId={workflowId}
      historyKey={historyKey}
    />
  );
}
