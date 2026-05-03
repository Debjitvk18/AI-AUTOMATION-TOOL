import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWorkflowSchema } from "@/lib/schemas";
import { normalizeGraphJson, validateGraphJson } from "@/lib/workflow-graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });
  return NextResponse.json({ workflows });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createWorkflowSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const graphJson = normalizeGraphJson(parsed.data.graphJson);
  if (graphJson.nodes.length > 0) {
    try {
      validateGraphJson(graphJson);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid graph" },
        { status: 400 },
      );
    }
  }

  const wf = await prisma.workflow.create({
    data: {
      userId,
      name: parsed.data.name ?? "Untitled workflow",
      graphJson: graphJson as object,
    },
  });
  return NextResponse.json({ workflow: wf });
}
