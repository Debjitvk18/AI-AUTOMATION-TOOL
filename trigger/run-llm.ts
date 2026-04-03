import { GoogleGenerativeAI } from "@google/generative-ai";
import { task } from "@trigger.dev/sdk";

export type RunLlmPayload = {
  workflowRunId: string;
  nodeId: string;
  userId: string;
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userMessage: string;
  imageUrls: string[];
};

async function callGemini(payload: RunLlmPayload): Promise<{ outputText: string }> {
  const genAI = new GoogleGenerativeAI(payload.apiKey);
  const model = genAI.getGenerativeModel({
    model: payload.model,
    ...(payload.systemPrompt?.trim()
      ? { systemInstruction: payload.systemPrompt.trim() }
      : {}),
  });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: payload.userMessage },
  ];

  for (const url of payload.imageUrls) {
    console.log(`[run-llm] Fetching image: ${url.slice(0, 80)}…`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to fetch image: ${url}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get("content-type") ?? "image/jpeg";
    parts.push({
      inlineData: {
        mimeType: mime.split(";")[0]!.trim(),
        data: buf.toString("base64"),
      },
    });
  }

  console.log(`[run-llm] Calling Gemini API (${parts.length} parts)…`);
  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  const text = result.response.text();
  console.log(`[run-llm] ✓ Response received — ${text.length} chars`);
  return { outputText: text };
}

async function callOpenAI(payload: RunLlmPayload): Promise<{ outputText: string }> {
  const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

  if (payload.systemPrompt?.trim()) {
    messages.push({ role: "system", content: payload.systemPrompt.trim() });
  }

  if (payload.imageUrls.length > 0) {
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: payload.userMessage },
    ];
    for (const url of payload.imageUrls) {
      content.push({ type: "image_url", image_url: { url } });
    }
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: payload.userMessage });
  }

  console.log(`[run-llm] Calling OpenAI API…`);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${payload.apiKey}`,
    },
    body: JSON.stringify({
      model: payload.model,
      messages,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${error}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const text = data.choices[0]?.message?.content || "";
  console.log(`[run-llm] ✓ Response received — ${text.length} chars`);
  return { outputText: text };
}

async function callClaude(payload: RunLlmPayload): Promise<{ outputText: string }> {
  const content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [
    { type: "text", text: payload.userMessage },
  ];

  for (const url of payload.imageUrls) {
    console.log(`[run-llm] Fetching image: ${url.slice(0, 80)}…`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to fetch image: ${url}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get("content-type") ?? "image/jpeg";
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mime.split(";")[0]!.trim(),
        data: buf.toString("base64"),
      },
    });
  }

  console.log(`[run-llm] Calling Claude API…`);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": payload.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: payload.model,
      max_tokens: 4096,
      ...(payload.systemPrompt?.trim() ? { system: payload.systemPrompt.trim() } : {}),
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${error}`);
  }

  const data = await res.json() as { content: Array<{ text: string }> };
  const text = data.content[0]?.text || "";
  console.log(`[run-llm] ✓ Response received — ${text.length} chars`);
  return { outputText: text };
}

async function callBedrock(payload: RunLlmPayload): Promise<{ outputText: string }> {
  // Note: AWS Bedrock requires AWS SDK and proper credentials setup
  // This is a placeholder - you'll need to install @aws-sdk/client-bedrock-runtime
  throw new Error("Amazon Bedrock support requires AWS SDK configuration. Please use Gemini, OpenAI, or Claude for now.");
}

export const runLlmTask = task({
  id: "run-llm",
  retry: { maxAttempts: 2 },
  run: async (payload: RunLlmPayload) => {
    console.log(`[run-llm] Starting — provider: ${payload.provider}, model: ${payload.model}, msgLen: ${payload.userMessage.length}, images: ${payload.imageUrls.length}`);
    
    const apiKey = payload.apiKey?.trim();
    if (!apiKey) {
      console.error("[run-llm] apiKey is not provided in payload");
      throw new Error("API key is required in the LLM node");
    }

    switch (payload.provider) {
      case "gemini":
        return await callGemini(payload);
      case "openai":
        return await callOpenAI(payload);
      case "claude":
        return await callClaude(payload);
      case "bedrock":
        return await callBedrock(payload);
      default:
        throw new Error(`Unsupported LLM provider: ${payload.provider}`);
    }
  },
});
