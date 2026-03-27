"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Video } from "lucide-react";
import { useRef } from "react";
import { HANDLE } from "@/lib/handles";
import { useWorkflowStore } from "@/store/workflow-store";
import { NodeShell } from "./NodeShell";

export function UploadVideoNode({ id, data, selected }: NodeProps) {
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
        title="Upload video"
        icon={<Video className="h-3.5 w-3.5 text-violet-400" />}
        selected={selected}
        running={running}
      >
        <input
          title="Choose video"
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-1.5 text-left text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
        >
          MP4, MOV, WebM, M4V…
        </button>
        {url ? (
          <video src={url} controls className="mt-1 max-h-48 w-full rounded-lg" />
        ) : null}
      </NodeShell>
      <Handle
        id={HANDLE.videoOut}
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-violet-500/60 !bg-violet-600"
      />
    </div>
  );
}
