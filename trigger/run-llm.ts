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

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 45000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function nonEmpty(v: string | undefined | null): string | undefined {
  const s = String(v ?? "").trim();
  return s ? s : undefined;
}

function providerApiKey(provider: string, payloadApiKey: string): string {
  const direct = nonEmpty(payloadApiKey);
  if (direct) return direct;

  if (provider === "gemini") return nonEmpty(process.env.GEMINI_API_KEY) ?? "";
  if (provider === "openai") return nonEmpty(process.env.OPENAI_API_KEY) ?? "";
  if (provider === "claude") return nonEmpty(process.env.ANTHROPIC_API_KEY) ?? "";
  return "";
}

function normalizeOpenAiText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

async function responseError(prefix: string, res: Response): Promise<Error> {
  const text = await res.text();
  return new Error(`${prefix}: ${res.status} ${res.statusText} - ${text.slice(0, 800)}`);
}

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
    const r = await fetchWithTimeout(url, undefined, 30000);
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
  const text = result.response.text()?.trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
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
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${payload.apiKey}`,
    },
    body: JSON.stringify({
      model: payload.model,
      messages,
    }),
  }, 45000);

  if (!res.ok) {
    throw await responseError("OpenAI API error", res);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(`OpenAI API error: ${data.error.message}`);

  const text = normalizeOpenAiText(data.choices?.[0]?.message?.content);
  if (!text) throw new Error("OpenAI returned an empty response");
  console.log(`[run-llm] ✓ Response received — ${text.length} chars`);
  return { outputText: text };
}

async function callClaude(payload: RunLlmPayload): Promise<{ outputText: string }> {
  const content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [
    { type: "text", text: payload.userMessage },
  ];

  for (const url of payload.imageUrls) {
    console.log(`[run-llm] Fetching image: ${url.slice(0, 80)}…`);
    const r = await fetchWithTimeout(url, undefined, 30000);
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
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
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
  }, 45000);

  if (!res.ok) {
    throw await responseError("Claude API error", res);
  }

  const data = await res.json() as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(`Claude API error: ${data.error.message}`);

  const text = (data.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();

  if (!text) throw new Error("Claude returned an empty response");
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

    const apiKey = providerApiKey(payload.provider, payload.apiKey);
    if (!apiKey) {
      console.error(`[run-llm] API key missing for provider: ${payload.provider}`);
      throw new Error(`Missing API key for provider '${payload.provider}'. Set it in the node or environment variables.`);
    }

    const normalized: RunLlmPayload = {
      ...payload,
      apiKey,
      userMessage: payload.userMessage.trim(),
      systemPrompt: payload.systemPrompt?.trim() || undefined,
    };

    if (!normalized.userMessage) throw new Error("User message is required");

    switch (normalized.provider) {
      case "gemini":
        return await callGemini(normalized);
      case "openai":
        return await callOpenAI(normalized);
      case "claude":
        return await callClaude(normalized);
      case "bedrock":
        return await callBedrock(normalized);
      default:
        throw new Error(`Unsupported LLM provider: ${normalized.provider}`);
    }
  },
});
