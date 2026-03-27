"use client";

import { useCallback, useEffect, useState } from "react";
import { getSampleGraph } from "@/lib/sample-workflow";
import { useWorkflowStore } from "@/store/workflow-store";
import { WorkflowShell } from "./WorkflowShell";

export function WorkflowPageClient() {
  const setWorkflowMeta = useWorkflowStore((s) => s.setWorkflowMeta);
  const setGraph = useWorkflowStore((s) => s.setGraph);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const workflowId = useWorkflowStore((s) => s.workflowId);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const bootstrap = useCallback(async () => {
    const listRes = await fetch("/api/workflows");
    const listJson = await listRes.json();
    if (!listRes.ok) return;
    const workflows = listJson.workflows as { id: string; name: string }[];
    if (workflows.length > 0) {
      const w = workflows[0]!;
      const gr = await fetch(`/api/workflows/${w.id}`);
      const gj = await gr.json();
      if (!gr.ok) return;
      const wf = gj.workflow as { id: string; name: string; graphJson: { nodes: unknown[]; edges: unknown[] } };
      setWorkflowMeta(wf.id, wf.name);
      setGraph(wf.graphJson.nodes as never[], wf.graphJson.edges as never[]);
      return;
    }
    const sample = getSampleGraph();
    const cr = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sample workflow",
        graphJson: {
          nodes: sample.nodes,
          edges: sample.edges,
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      }),
    });
    const cj = await cr.json();
    if (!cr.ok) return;
    const created = cj.workflow as { id: string; name: string };
    setWorkflowMeta(created.id, created.name);
    setGraph(sample.nodes, sample.edges);
  }, [setGraph, setWorkflowMeta]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const save = useCallback(async () => {
    if (!workflowId) return;
    setSaving(true);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graphJson: {
            nodes,
            edges,
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [edges, nodes, workflowId]);

  const run = useCallback(
    async (scope: "FULL" | "PARTIAL" | "SINGLE", targetNodeIds?: string[]) => {
      if (!workflowId) return;
      setRunning(true);
      try {
        await save();
        const res = await fetch(`/api/workflows/${workflowId}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graphJson: {
              nodes,
              edges,
              viewport: { x: 0, y: 0, zoom: 1 },
            },
            scope,
            targetNodeIds,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Run failed");
        setHistoryKey((k) => k + 1);
      } finally {
        setRunning(false);
      }
    },
    [edges, nodes, save, workflowId],
  );

  const onRunFull = useCallback(async () => {
    await run("FULL");
  }, [run]);

  const onRunSelected = useCallback(async () => {
    const selected = nodes.filter((n) => n.selected).map((n) => n.id);
    if (selected.length === 0) return;
    if (selected.length === 1) await run("SINGLE", selected);
    else await run("PARTIAL", selected);
  }, [nodes, run]);

  return (
    <WorkflowShell
      onSave={save}
      onRunFull={onRunFull}
      onRunSelected={onRunSelected}
      saving={saving}
      running={running}
      workflowId={workflowId}
      historyKey={historyKey}
    />
  );
}
