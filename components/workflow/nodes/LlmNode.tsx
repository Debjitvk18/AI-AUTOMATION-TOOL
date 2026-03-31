"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { GEMINI_MODEL_OPTIONS } from "@/lib/constants";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function LlmNode({ id, data, selected }: NodeProps) {
  const edges = useWorkflowStore((s) => s.edges);
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const d = data as {
    model?: string;
    systemPrompt?: string;
    userMessage?: string;
    lastOutput?: string;
  };

  const sysConnected = edges.some((e) => e.target === id && e.targetHandle === HANDLE.systemPrompt);
  const userConnected = edges.some((e) => e.target === id && e.targetHandle === HANDLE.userMessage);

  async function runSingle() {
    if (!workflowId) {
      setErr("Save workflow first");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graphJson: { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } },
          scope: "SINGLE",
          targetNodeIds: [id],
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Run failed");
      const runId = j.runId as string;
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const rr = await fetch(`/api/workflows/${workflowId}/runs/${runId}`);
        const rj = await rr.json();
        if (!rr.ok) throw new Error(rj.error);
        const run = rj.run;
        if (run.status !== "RUNNING") {
          const nr = run.nodeRuns?.find((x: { nodeId: string }) => x.nodeId === id);
          if (nr?.status === "SUCCESS" && nr.outputsJson) {
            const out = nr.outputsJson as { outputText?: string };
            update(id, { lastOutput: out.outputText ?? "" });
          } else if (nr?.error) {
            setErr(nr.error);
          }
          break;
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  const inputClasses = `w-full rounded-lg border px-2 py-1 text-sm outline-none transition
    border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50 disabled:cursor-not-allowed disabled:opacity-40
    dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600`;

  return (
    <div className="min-w-[300px] max-w-[420px]">
      <Handle
        id={HANDLE.systemPrompt}
        type="target"
        position={Position.Left}
        style={{ top: "22%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800"
      />
      <Handle
        id={HANDLE.userMessage}
        type="target"
        position={Position.Left}
        style={{ top: "42%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800"
      />
      <Handle
        id={HANDLE.images}
        type="target"
        position={Position.Left}
        style={{ top: "62%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800"
      />
      <NodeShell
        title="Run LLM"
        icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />}
        selected={selected}
        running={running}
      >
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Model
        </label>
        <select
          title="Model"
          value={d.model ?? "gemini-2.0-flash"}
          onChange={(e) => update(id, { model: e.target.value })}
          className={inputClasses}
        >
          {GEMINI_MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          System (optional)
        </label>
        <textarea
          disabled={sysConnected}
          value={d.systemPrompt ?? ""}
          onChange={(e) => update(id, { systemPrompt: e.target.value })}
          placeholder="System instructions…"
          className={`min-h-[52px] resize-y ${inputClasses}`}
        />

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          User message
        </label>
        <textarea
          disabled={userConnected}
          value={d.userMessage ?? ""}
          onChange={(e) => update(id, { userMessage: e.target.value })}
          placeholder="Required user message…"
          className={`min-h-[72px] resize-y ${inputClasses}`}
        />

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSingle()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Run node
          </button>
          {err ? <span className="text-xs text-red-500 dark:text-red-400">{err}</span> : null}
        </div>

        {d.lastOutput ? (
          <div className="mt-2 rounded-lg border p-2 text-sm leading-relaxed
            border-zinc-200 bg-zinc-50 text-zinc-700
            dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-300">
            {d.lastOutput}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">Output appears here after a successful run.</p>
        )}
      </NodeShell>
      <Handle
        id={HANDLE.llmOut}
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-violet-500/60 !bg-violet-600"
      />
    </div>
  );
}
