import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; runId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workflowId, runId } = await params;

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, workflowId, userId },
    include: { nodeRuns: { orderBy: { createdAt: "asc" } } },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
}
