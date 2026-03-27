import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const wf = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    name: wf.name,
    graphJson: wf.graphJson,
  };

  return NextResponse.json(exportPayload, {
    headers: {
      "Content-Disposition": `attachment; filename="nextflow-${wf.id}.json"`,
    },
  });
}
