import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeGraphJson, validateGraphJson } from "@/lib/workflow-graph";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  prompt: z.string().min(1).max(6000),
});

const SYSTEM_PROMPT = `
You are an expert workflow graph generator for a visual automation platform.

Your task is to convert a natural language instruction into a VALID workflow graph JSON.

Return ONLY valid JSON.

HARD CONSTRAINTS:
- ONLY use these node types in your JSON: manualTrigger, webhookTrigger, scheduleTrigger, uploadImage, uploadVideo, runLLM, cropImage, extractFrame, text, ifElse, dataTransform, httpRequest, sendNotification
- DO NOT invent node types
- DO NOT leave required fields empty
- DO NOT create disconnected nodes
- Ensure the graph is a valid DAG
- Every edge must connect compatible handles
- Prefer the minimal number of nodes needed
- If a value can come from upstream, do not duplicate it in downstream config

HANDLE RULES:
- uploadVideo.video_url -> extractFrame.video_url
- extractFrame.image_url -> runLLM.images
- uploadImage.image_url -> runLLM.images
- text.text -> runLLM.system_prompt
- text.text -> runLLM.user_message
- runLLM.output_text -> sendNotification.message
- text.text -> httpRequest.url
- text.text -> httpRequest.body
- text.text -> dataTransform.input
- text.text -> ifElse.condition
- dataTransform.output_text -> sendNotification.message
- httpRequest.output_text -> dataTransform.input

GRAPH BUILDING RULES:
- Use left-to-right layout with increasing x positions
- Use y spacing when branches are parallel
- Connect all nodes meaningfully
- Use manualTrigger if the request does not specify another trigger and the workflow still makes sense with one
- If the workflow cannot be represented with the allowed catalog, return:
  {"error":"UNSUPPORTED_WORKFLOW","reason":"..."}

NODE CONFIG EXPECTATIONS:
- manualTrigger config: { "inputData": stringified JSON }
- webhookTrigger config: { "hookId": non-empty string }
- scheduleTrigger config: { "cron": string, "description": string }
- uploadImage config: { "url": "" } if no concrete image URL is provided yet
- uploadVideo config: { "url": "" } if no concrete video URL is provided yet
- runLLM config: { "provider": "gemini", "model": "gemini-2.5-flash", "system_prompt": string, "user_message": string }
- cropImage config: { "x": number, "y": number, "width": number, "height": number }
- extractFrame config: { "timestamp": string }
- text config: { "text": string }
- ifElse config: { "field": string, "operator": string, "value": string }
- dataTransform config: { "operation": string, "template": string }
- httpRequest config: { "url": string, "method": string, "headers": object, "body": string }
- sendNotification config: { "type": "console" | "webhook", "webhook_url": string, "message": string }

OUTPUT FORMAT:
{
  "nodes": [
    {
      "id": "node-1",
      "type": "nodeType",
      "position": { "x": 0, "y": 0 },
      "data": {
        "label": "Readable name",
        "config": {}
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "sourceHandle": "output_handle",
      "targetHandle": "input_handle"
    }
  ]
}
`.trim();

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return trimmed;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `USER REQUEST:\n${parsed.data.prompt}\n\nGenerate the workflow JSON now.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text()?.trim();
    if (!text) {
      return NextResponse.json({ error: "Model returned an empty response" }, { status: 502 });
    }

    const rawGraph = JSON.parse(extractJson(text)) as Record<string, unknown>;
    if (rawGraph.error === "UNSUPPORTED_WORKFLOW") {
      return NextResponse.json(rawGraph, { status: 422 });
    }

    const graphJson = normalizeGraphJson(rawGraph);
    validateGraphJson(graphJson);

    return NextResponse.json({ graphJson, rawGraphJson: rawGraph });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workflow generation failed" },
      { status: 500 },
    );
  }
}
