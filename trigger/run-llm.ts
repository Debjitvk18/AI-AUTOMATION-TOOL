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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Trigger.dev environment");

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

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    const text = result.response.text();
    return { outputText: text };
  },
});
