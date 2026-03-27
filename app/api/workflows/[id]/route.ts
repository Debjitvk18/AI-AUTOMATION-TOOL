import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateWorkflowSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const wf = await prisma.workflow.findFirst({
    where: { id, userId },
  });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ workflow: wf });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = updateWorkflowSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wf = await prisma.workflow.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.graphJson ? { graphJson: parsed.data.graphJson as object } : {}),
    },
  });
  return NextResponse.json({ workflow: wf });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
