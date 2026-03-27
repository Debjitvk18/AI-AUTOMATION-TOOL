import { auth } from "@clerk/nextjs/server";
import type { Edge, Node } from "@xyflow/react";
import { NodeRunStatus, RunStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { computeExecutableNodeIds } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { createRunSchema } from "@/lib/schemas";
import { workflowOrchestratorTask } from "@/trigger/orchestrator";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workflowId } = await params;

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
    take: 80,
    include: {
      nodeRuns: { orderBy: { createdAt: "asc" } },
    },
  });
  return NextResponse.json({ runs });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workflowId } = await params;

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = createRunSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { graphJson, scope, targetNodeIds } = parsed.data;
  const nodes = graphJson.nodes as Node[];
  const edges = graphJson.edges as Edge[];

  let nodeIds: string[];
  try {
    nodeIds = computeExecutableNodeIds(scope, nodes, edges, targetNodeIds);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid execution plan" },
      { status: 400 },
    );
  }

  const run = await prisma.workflowRun.create({
    data: {
      userId,
      workflowId,
      scope,
      status: RunStatus.RUNNING,
    },
  });

  await prisma.nodeRun.createMany({
    data: nodeIds.map((nodeId) => ({
      runId: run.id,
      nodeId,
      nodeType: String(nodes.find((n) => n.id === nodeId)?.type ?? "unknown"),
      status: NodeRunStatus.PENDING,
    })),
  });

  const payload = {
    workflowRunId: run.id,
    workflowId,
    userId,
    scope,
    targetNodeIds,
    graph: { nodes, edges },
  };

  const handle = await workflowOrchestratorTask.trigger(payload);

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { triggerRunId: handle.id },
  });

  return NextResponse.json({ runId: run.id, triggerRunId: handle.id });
}
