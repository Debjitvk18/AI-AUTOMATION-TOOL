"use client";

import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";

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
  const [path] = getBezierPath({
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
    </>
  );
}
