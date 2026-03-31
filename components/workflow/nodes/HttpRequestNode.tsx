"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function HttpRequestNode({ id, data, selected }: NodeProps) {
  const edges = useWorkflowStore((s) => s.edges);
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));
  const [testing, setTesting] = useState(false);

  const d = data as { method?: string; url?: string; headers?: string; body?: string; lastResponse?: string };
  const urlWired = edges.some((e) => e.target === id && e.targetHandle === HANDLE.httpUrlIn);
  const bodyWired = edges.some((e) => e.target === id && e.targetHandle === HANDLE.httpBodyIn);

  async function testRequest() {
    setTesting(true);
    try {
      const res = await fetch(d.url || "", {
        method: d.method || "GET",
        headers: d.headers ? JSON.parse(d.headers) : {},
        ...(d.method !== "GET" && d.body ? { body: d.body } : {}),
      });
      const text = await res.text();
      update(id, { lastResponse: text.slice(0, 2000) });
    } catch (e) {
      update(id, { lastResponse: `Error: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setTesting(false);
    }
  }

  const inputCls = `w-full rounded-lg border px-2 py-1 text-sm outline-none transition
    border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50 disabled:opacity-40
    dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200 dark:placeholder:text-zinc-600`;

  return (
    <div className="min-w-[280px] max-w-[400px]">
      <Handle id={HANDLE.httpUrlIn} type="target" position={Position.Left} style={{ top: "30%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800" />
      <Handle id={HANDLE.httpBodyIn} type="target" position={Position.Left} style={{ top: "70%" }}
        className="!h-2.5 !w-2.5 !border !border-zinc-400 dark:!border-zinc-500 !bg-zinc-300 dark:!bg-zinc-800" />
      <NodeShell title="HTTP Request" icon={<Globe className="h-3.5 w-3.5 text-orange-400" />} selected={selected} running={running}>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Method</label>
        <select title="HTTP Method" value={d.method ?? "GET"} onChange={(e) => update(id, { method: e.target.value })} className={inputCls}>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">URL</label>
        <input disabled={urlWired} value={d.url ?? ""} onChange={(e) => update(id, { url: e.target.value })}
          placeholder="https://api.example.com/data" className={inputCls} />

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Headers (JSON)</label>
        <textarea value={d.headers ?? "{}"} onChange={(e) => update(id, { headers: e.target.value })}
          placeholder='{"Authorization": "Bearer ..."}' className={`min-h-[40px] resize-y ${inputCls}`} />

        <label className="mt-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Body</label>
        <textarea disabled={bodyWired} value={d.body ?? ""} onChange={(e) => update(id, { body: e.target.value })}
          placeholder="Request body…" className={`min-h-[40px] resize-y ${inputCls}`} />

        <button type="button" disabled={testing} onClick={testRequest}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-orange-500 disabled:opacity-50">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Test
        </button>

        {d.lastResponse ? (
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg border p-2 text-xs whitespace-pre-wrap break-all
            border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
            {d.lastResponse}
          </pre>
        ) : null}
      </NodeShell>
      <Handle id={HANDLE.httpOut} type="source" position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-orange-500/60 !bg-orange-500" />
    </div>
  );
}
