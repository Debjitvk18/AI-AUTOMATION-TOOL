"use client";

import { cn } from "@/lib/cn";

export function NodeShell({
  title,
  icon,
  selected,
  running,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  selected?: boolean;
  running?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-[220px] rounded-xl border shadow-xl backdrop-blur",
        "bg-white/95 dark:bg-zinc-950/90",
        "border-zinc-200 dark:border-zinc-800/90",
        selected && "border-violet-500/70 ring-1 ring-violet-500/40",
        running && "nf-node-running border-violet-400/60",
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800/80">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          {title}
        </span>
      </div>
      <div className="space-y-2 p-3 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  );
}
