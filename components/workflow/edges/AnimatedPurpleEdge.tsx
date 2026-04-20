"use client";

import { BaseEdge, type EdgeProps, getBezierPath, EdgeLabelRenderer } from "@xyflow/react";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";

export function AnimatedPurpleEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const removeEdge = useWorkflowStore((s) => s.removeEdge);

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className="nf-animated-edge-path"
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: "#a855f7",
          strokeWidth: 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan group/edge-del"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeEdge(id);
            }}
            title="Remove connection"
            className="
              flex h-5 w-5 items-center justify-center
              rounded-full border shadow-md
              opacity-0 transition-opacity duration-150
              group-hover/edge-del:opacity-100
              border-zinc-300 bg-white text-zinc-500 hover:border-red-400 hover:bg-red-50 hover:text-red-600
              dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400
              dark:hover:border-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400
            "
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
