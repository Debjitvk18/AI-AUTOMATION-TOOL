import { auth } from "@clerk/nextjs/server";
import type { Edge, Node } from "@xyflow/react";
import { NodeRunStatus, RunStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { analyzeNodeFailure, type FailureInput } from "@/lib/auto-repair";
import { computeExecutableNodeIds } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { repairRequestSchema } from "@/lib/schemas";
import { workflowOrchestratorTask } from "@/trigger/orchestrator";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; runId: string }> };

/**
 * GET /api/workflows/[id]/runs/[runId]/repair?nodeId=xxx
 * Dry-run repair analysis for a specific failed node.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workflowId, runId } = await params;

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId query parameter is required" }, { status: 400 });
  }

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, workflowId },
    include: { nodeRuns: true },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const failedNodeRun = run.nodeRuns.find(
    (nr) => nr.nodeId === nodeId && nr.status === NodeRunStatus.FAILED,
  );
  if (!failedNodeRun) {
    return NextResponse.json({ error: "No failed NodeRun found for the specified nodeId" }, { status: 404 });
  }

  // Build upstream outputs from TWO sources:
  // 1. Successful sibling NodeRuns in the same run
  // 2. _failureContext stored by the orchestrator in the failed node's outputsJson
  const upstreamOutputs: Record<string, Record<string, unknown>> = {};

  // Source 1: Successful sibling NodeRuns
  for (const nr of run.nodeRuns) {
    if (nr.status === NodeRunStatus.SUCCESS && nr.outputsJson) {
      const out = nr.outputsJson as Record<string, unknown>;
      if (out && typeof out === "object") {
        upstreamOutputs[nr.nodeId] = out;
      }
    }
  }

  // Source 2: _failureContext from orchestrator (enriched failure data)
  const failedOutputs = failedNodeRun.outputsJson as Record<string, unknown> | null;
  if (failedOutputs?._failureContext && typeof failedOutputs._failureContext === "object") {
    const ctx = failedOutputs._failureContext as Record<string, unknown>;
    if (ctx.upstreamOutputs && typeof ctx.upstreamOutputs === "object") {
      const ctxUpstream = ctx.upstreamOutputs as Record<string, Record<string, unknown>>;
      for (const [nid, out] of Object.entries(ctxUpstream)) {
        if (!upstreamOutputs[nid]) {
          upstreamOutputs[nid] = out;
        }
      }
    }
  }

  const failureInput: FailureInput = {
    nodeType: failedNodeRun.nodeType,
    inputsJson: (failedNodeRun.inputsJson as Record<string, unknown>) ?? {},
    upstreamOutputs,
    error: failedNodeRun.error ?? "Unknown error",
  };

  const result = analyzeNodeFailure(failureInput);
  return NextResponse.json(result);
}

/**
 * POST /api/workflows/[id]/runs/[runId]/repair
 * Analyze + optionally apply repair and re-trigger.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workflowId, runId } = await params;

  const json = await req.json().catch(() => null);
  const parsed = repairRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { nodeId, applyFix } = parsed.data;

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, workflowId },
    include: { nodeRuns: true },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const failedNodeRun = run.nodeRuns.find(
    (nr) => nr.nodeId === nodeId && nr.status === NodeRunStatus.FAILED,
  );
  if (!failedNodeRun) {
    return NextResponse.json({ error: "No failed NodeRun found for the specified nodeId" }, { status: 404 });
  }

  // Build upstream outputs from both sources
  const upstreamOutputs: Record<string, Record<string, unknown>> = {};

  for (const nr of run.nodeRuns) {
    if (nr.status === NodeRunStatus.SUCCESS && nr.outputsJson) {
      const out = nr.outputsJson as Record<string, unknown>;
      if (out && typeof out === "object") {
        upstreamOutputs[nr.nodeId] = out;
      }
    }
  }

  // Merge _failureContext from orchestrator
  const failedOutputs = failedNodeRun.outputsJson as Record<string, unknown> | null;
  if (failedOutputs?._failureContext && typeof failedOutputs._failureContext === "object") {
    const ctx = failedOutputs._failureContext as Record<string, unknown>;
    if (ctx.upstreamOutputs && typeof ctx.upstreamOutputs === "object") {
      const ctxUpstream = ctx.upstreamOutputs as Record<string, Record<string, unknown>>;
      for (const [nid, out] of Object.entries(ctxUpstream)) {
        if (!upstreamOutputs[nid]) {
          upstreamOutputs[nid] = out;
        }
      }
    }
  }

  const failureInput: FailureInput = {
    nodeType: failedNodeRun.nodeType,
    inputsJson: (failedNodeRun.inputsJson as Record<string, unknown>) ?? {},
    upstreamOutputs,
    error: failedNodeRun.error ?? "Unknown error",
  };

  const result = analyzeNodeFailure(failureInput);

  // If not applying or no fix, return analysis only
  if (!applyFix || result.status !== "FIX_APPLIED" || !result.fix) {
    return NextResponse.json(result);
  }

  // Apply fix: create a new run with patched graph
  const graph = wf.graphJson as unknown as { nodes: Node[]; edges: Edge[] };
  if (!graph?.nodes || !graph?.edges) {
    return NextResponse.json({ error: "Invalid workflow graph" }, { status: 500 });
  }

  // Patch the failed node's data with the fixed inputs
  const patchedNodes = graph.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    return {
      ...n,
      data: {
        ...(typeof n.data === "object" ? n.data : {}),
        ...result.fix!.updated_inputs,
      },
    };
  });

  const patchedGraph = { nodes: patchedNodes, edges: graph.edges };

  // Create new run with resume
  const newRun = await prisma.workflowRun.create({
    data: {
      userId,
      workflowId,
      scope: run.scope,
      status: RunStatus.RUNNING,
    },
  });

  // Compute executable node IDs
  let nodeIds: string[];
  try {
    nodeIds = computeExecutableNodeIds(run.scope, patchedNodes, graph.edges, undefined);
  } catch {
    nodeIds = patchedNodes.map((n) => n.id);
  }

  // Copy SUCCESS NodeRun records from original run, create PENDING for rest
  await prisma.nodeRun.createMany({
    data: nodeIds.map((nid) => {
      const originalNr = run.nodeRuns.find((nr) => nr.nodeId === nid);
      const isBeforeFailed = originalNr?.status === NodeRunStatus.SUCCESS;
      return {
        runId: newRun.id,
        nodeId: nid,
        nodeType: String(patchedNodes.find((n) => n.id === nid)?.type ?? "unknown"),
        status: isBeforeFailed ? NodeRunStatus.SUCCESS : NodeRunStatus.PENDING,
        outputsJson: isBeforeFailed ? (originalNr!.outputsJson ?? undefined) : undefined,
        inputsJson: isBeforeFailed ? (originalNr!.inputsJson ?? undefined) : undefined,
        durationMs: isBeforeFailed ? originalNr!.durationMs : undefined,
      };
    }),
  });

  const handle = await workflowOrchestratorTask.trigger({
    workflowRunId: newRun.id,
    workflowId,
    userId,
    scope: run.scope,
    graph: patchedGraph,
    resumeFromNodeId: nodeId,
  });

  await prisma.workflowRun.update({
    where: { id: newRun.id },
    data: { triggerRunId: handle.id },
  });

  return NextResponse.json({
    ...result,
    applied: true,
    newRunId: newRun.id,
    triggerRunId: handle.id,
  });
}
