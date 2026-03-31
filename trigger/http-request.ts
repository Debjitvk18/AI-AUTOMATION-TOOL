import { task } from "@trigger.dev/sdk";

export type HttpRequestPayload = {
  method: string;
  url: string;
  headers: string; // JSON string
  body: string;
};

export const httpRequestTask = task({
  id: "http-request",
  maxDuration: 60,
  run: async (payload: HttpRequestPayload) => {
    const { method, url, headers: headersStr, body } = payload;

    console.log(`[http-request] ${method} ${url}`);

    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(headersStr || "{}");
    } catch {
      console.warn("[http-request] Invalid headers JSON, using empty headers");
    }

    const fetchOpts: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        ...parsedHeaders,
      },
    };

    if (method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD" && body) {
      fetchOpts.body = body;
    }

    const res = await fetch(url, fetchOpts);
    const responseText = await res.text();

    console.log(`[http-request] Response status: ${res.status}, body length: ${responseText.length}`);

    return {
      statusCode: res.status,
      responseText: responseText.slice(0, 10000), // Cap at 10KB
      text: responseText.slice(0, 10000), // Alias for downstream text consumption
    };
  },
});
