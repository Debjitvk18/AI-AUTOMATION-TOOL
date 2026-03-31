import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ hookId: string }> };

/**
 * Webhook endpoint that receives incoming POST requests.
 * Finds any workflow containing a webhookTrigger node with the matching hookId,
 * and stores the payload in the node's data.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { hookId } = await params;

  console.log(`[webhook] Received POST for hookId: ${hookId}`);

  let body: string;
  try {
    const raw = await req.text();
    body = raw || "{}";
  } catch {
    body = "{}";
  }

  console.log(`[webhook] Payload length: ${body.length}`);

  // Find all workflows and look for the matching hookId in their graphJson
  const workflows = await prisma.workflow.findMany({
    select: { id: true, graphJson: true },
  });

  let found = false;
  for (const wf of workflows) {
    const graph = wf.graphJson as { nodes?: { id: string; type: string; data: Record<string, unknown> }[] };
    if (!graph.nodes) continue;

    for (const node of graph.nodes) {
      if (node.type === "webhookTrigger" && node.data?.hookId === hookId) {
        // Update the node's lastPayload in the stored graph
        node.data.lastPayload = body;
        await prisma.workflow.update({
          where: { id: wf.id },
          data: { graphJson: graph as object },
        });
        found = true;
        console.log(`[webhook] Updated workflow ${wf.id}, node ${node.id}`);
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    console.log(`[webhook] No workflow found for hookId: ${hookId}`);
    return NextResponse.json({ ok: false, error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message: "Payload stored. Run the workflow to process it." });
}

// Also support GET for testing
export async function GET(_req: Request, { params }: RouteParams) {
  const { hookId } = await params;
  return NextResponse.json({
    ok: true,
    hookId,
    message: "Webhook endpoint active. Send a POST request with your payload.",
  });
}
