import { GoogleGenerativeAI } from "@google/generative-ai";
import { task } from "@trigger.dev/sdk";

export type RunLlmPayload = {
  workflowRunId: string;
  nodeId: string;
  userId: string;
  model: string;
  systemPrompt?: string;
  userMessage: string;
  imageUrls: string[];
};

export const runLlmTask = task({
  id: "run-llm",
  retry: { maxAttempts: 2 },
  run: async (payload: RunLlmPayload) => {
    console.log(`[run-llm] Starting — model: ${payload.model}, msgLen: ${payload.userMessage.length}, images: ${payload.imageUrls.length}`);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[run-llm] GEMINI_API_KEY is not set!");
      throw new Error("GEMINI_API_KEY is not set in Trigger.dev environment");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
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
  },
});
