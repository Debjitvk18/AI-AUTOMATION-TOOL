"use client";

import {
  ChevronLeft,
  ChevronRight,
  Crop,
  Film,
  ImageIcon,
  Search,
  Sparkles,
  Type,
  Video,
} from "lucide-react";
import { useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { cn } from "@/lib/cn";

const quick: { type: string; label: string; icon: React.ReactNode }[] = [
  { type: "text", label: "Text", icon: <Type className="h-4 w-4" /> },
  { type: "uploadImage", label: "Upload image", icon: <ImageIcon className="h-4 w-4" /> },
  { type: "uploadVideo", label: "Upload video", icon: <Video className="h-4 w-4" /> },
  { type: "llm", label: "Run LLM", icon: <Sparkles className="h-4 w-4" /> },
  { type: "cropImage", label: "Crop image", icon: <Crop className="h-4 w-4" /> },
  { type: "extractFrame", label: "Extract frame", icon: <Film className="h-4 w-4" /> },
];

export function LeftSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const addNode = useWorkflowStore((s) => s.addNode);

  const filtered = quick.filter((x) => x.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-[var(--nf-panel)] transition-[width]",
        "border-zinc-200 dark:border-zinc-800/80",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-end border-b px-2 py-2
          border-zinc-200 text-zinc-400 hover:text-zinc-700
          dark:border-zinc-800/80 dark:text-zinc-500 dark:hover:text-zinc-200"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
      {!collapsed ? (
        <>
          <div className="border-b border-zinc-200 p-2 dark:border-zinc-800/80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-600" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search nodes…"
                className="w-full rounded-lg border py-1.5 pl-8 pr-2 text-xs outline-none transition
                  border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/40
                  dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200 dark:placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="px-2 py-2">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Quick access
            </p>
            <div className="flex flex-col gap-1">
              {filtered.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/reactflow", item.type);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => addNode(item.type)}
                  className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-xs transition
                    text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100
                    dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
                >
                  <span className="text-violet-500 dark:text-violet-400">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          {quick.map((item) => (
            <button
              key={item.type}
              type="button"
              title={item.label}
              onClick={() => addNode(item.type)}
              className="rounded-lg p-2 text-violet-500 transition hover:bg-zinc-100 dark:text-violet-400 dark:hover:bg-zinc-900"
            >
              {item.icon}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
