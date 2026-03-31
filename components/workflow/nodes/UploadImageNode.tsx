"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { useRef } from "react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function UploadImageNode({ id, data, selected }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const running = useWorkflowStore((s) => s.runningNodeIds.has(id));
  const url = String((data as { url?: string }).url ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("filename", f.name);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Upload failed");
    update(id, { url: j.url as string });
  }

  return (
    <div>
      <NodeShell
        title="Upload image"
        icon={<ImageIcon className="h-3.5 w-3.5 text-violet-400" />}
        selected={selected}
        running={running}
      >
        <input
          title="Choose image"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border px-2 py-1.5 text-left text-xs transition
            border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700
            dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
        >
          Choose JPG, PNG, WebP, GIF…
        </button>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="mt-1 max-h-40 w-full rounded-lg object-contain" />
        ) : null}
      </NodeShell>
      <Handle
        id={HANDLE.imageOut}
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-violet-500/60 !bg-violet-600"
      />
    </div>
  );
}
