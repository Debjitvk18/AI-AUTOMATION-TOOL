import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { graphJsonSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const importBodySchema = z.union([
  z.object({
    graphJson: graphJsonSchema,
    name: z.string().min(1).max(200).optional(),
  }),
  z.object({
    version: z.number().optional(),
    exportedAt: z.string().optional(),
    name: z.string().optional(),
    graphJson: graphJsonSchema,
  }),
]);

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = importBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const graphJson = parsed.data.graphJson;
  const name =
    "name" in parsed.data && parsed.data.name ? parsed.data.name : undefined;

  const wf = await prisma.workflow.update({
    where: { id },
    data: {
      graphJson: graphJson as object,
      ...(name ? { name } : {}),
    },
  });
  return NextResponse.json({ workflow: wf });
}
