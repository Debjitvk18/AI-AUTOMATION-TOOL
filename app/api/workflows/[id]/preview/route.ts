import { auth } from "@clerk/nextjs/server";
import type { Edge, Node } from "@xyflow/react";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulateWorkflow } from "@/lib/preview-engine";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/workflows/[id]/preview
 *
 * Simulates the workflow graph WITHOUT executing real tasks.
 * Returns predicted outputs for each node.
 *
 * Request body (optional):
 *   { graphJson?: { nodes, edges } }
 *
 * If graphJson is not provided, uses the saved workflow graph.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workflowId } = await params;

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  // Accept optional graphJson from request body (for unsaved changes)
  let nodes: Node[];
  let edges: Edge[];

  const body = await req.json().catch(() => null) as { graphJson?: { nodes?: Node[]; edges?: Edge[] } } | null;
  if (body?.graphJson?.nodes && body?.graphJson?.edges) {
    nodes = body.graphJson.nodes;
    edges = body.graphJson.edges;
  } else {
    const saved = wf.graphJson as unknown as { nodes?: Node[]; edges?: Edge[] };
    if (!saved?.nodes || !saved?.edges) {
      return NextResponse.json({ error: "No valid graph found" }, { status: 400 });
    }
    nodes = saved.nodes;
    edges = saved.edges;
  }

  // Fetch the last successful run's node results for reuse
  const lastRun = await prisma.workflowRun.findFirst({
    where: { workflowId, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    include: {
      nodeRuns: {
        where: { status: "SUCCESS" },
        select: { nodeId: true, nodeType: true, outputsJson: true },
      },
    },
  });

  const previousResults = lastRun?.nodeRuns.map((nr) => ({
    nodeId: nr.nodeId,
    nodeType: nr.nodeType,
    outputsJson: (nr.outputsJson as Record<string, unknown>) ?? null,
  })) ?? [];

  try {
    const preview = simulateWorkflow(nodes, edges, previousResults);
    return NextResponse.json({ preview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
