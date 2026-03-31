"use client";

import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crop,
  Film,
  GitBranch,
  Globe,
  ImageIcon,
  Play,
  Search,
  Shuffle,
  Sparkles,
  Type,
  Video,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { cn } from "@/lib/cn";

type NodeItem = { type: string; label: string; icon: React.ReactNode };
type Category = { name: string; items: NodeItem[] };

const categories: Category[] = [
  {
    name: "Triggers",
    items: [
      { type: "manualTrigger", label: "Manual Trigger", icon: <Play className="h-4 w-4" /> },
      { type: "webhookTrigger", label: "Webhook Trigger", icon: <Webhook className="h-4 w-4" /> },
      { type: "scheduleTrigger", label: "Schedule Trigger", icon: <Clock className="h-4 w-4" /> },
    ],
  },
  {
    name: "AI & Media",
    items: [
      { type: "llm", label: "Run LLM", icon: <Sparkles className="h-4 w-4" /> },
      { type: "uploadImage", label: "Upload Image", icon: <ImageIcon className="h-4 w-4" /> },
      { type: "uploadVideo", label: "Upload Video", icon: <Video className="h-4 w-4" /> },
      { type: "cropImage", label: "Crop Image", icon: <Crop className="h-4 w-4" /> },
      { type: "extractFrame", label: "Extract Frame", icon: <Film className="h-4 w-4" /> },
    ],
  },
  {
    name: "Logic & Data",
    items: [
      { type: "ifElse", label: "If / Else", icon: <GitBranch className="h-4 w-4" /> },
      { type: "dataTransform", label: "Data Transform", icon: <Shuffle className="h-4 w-4" /> },
      { type: "text", label: "Text", icon: <Type className="h-4 w-4" /> },
    ],
  },
  {
    name: "Integrations",
    items: [
      { type: "httpRequest", label: "HTTP Request", icon: <Globe className="h-4 w-4" /> },
      { type: "notification", label: "Send Notification", icon: <Bell className="h-4 w-4" /> },
    ],
  },
];

const allItems = categories.flatMap((c) => c.items);

export function LeftSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const addNode = useWorkflowStore((s) => s.addNode);

  const query = q.toLowerCase();
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((x) => x.label.toLowerCase().includes(query)),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-[var(--nf-panel)] transition-[width]",
        "border-zinc-200 dark:border-zinc-800/80",
        collapsed ? "w-14" : "w-64",
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
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {filteredCategories.map((cat) => (
              <div key={cat.name} className="mb-3">
                <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {cat.name}
                </p>
                <div className="flex flex-col gap-0.5">
                  {cat.items.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/reactflow", item.type);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => addNode(item.type)}
                      className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs transition
                        text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100
                        dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
                    >
                      <span className="text-violet-500 dark:text-violet-400">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 overflow-y-auto py-2">
          {allItems.map((item) => (
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
