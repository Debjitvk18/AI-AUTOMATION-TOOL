/**
 * Node Simulation — Dry Run Logic
 *
 * Produces mock/predicted outputs for each node type WITHOUT calling
 * external APIs, Trigger.dev, or any real services.
 */

export interface SimulatedOutput {
  nodeId: string;
  nodeType: string;
  status: "SIMULATED" | "FROM_HISTORY";
  output: Record<string, unknown>;
}

/**
 * Simulate a single node's output based on its type and resolved inputs.
 */
export function simulateNode(
  nodeType: string,
  data: Record<string, unknown>,
  resolvedInputs: Record<string, string>,
): Record<string, unknown> {
  switch (nodeType) {
    case "text":
      return { text: String(data.text ?? "") };

    case "uploadImage":
      return { url: String(data.url || "https://mock.nextflow.dev/image-placeholder.jpg") };

    case "uploadVideo":
      return { url: String(data.url || "https://mock.nextflow.dev/video-placeholder.mp4") };

    case "manualTrigger":
      return { text: String(data.inputData ?? "{}") };

    case "webhookTrigger":
      return { text: String(data.lastPayload ?? '{"event":"test","payload":{}}') };

    case "scheduleTrigger": {
      const now = new Date().toISOString();
      return { text: now, cron: String(data.cron ?? ""), triggeredAt: now };
    }

    case "llm": {
      const userMsg = resolvedInputs.userMessage || String(data.userMessage ?? "");
      const preview = userMsg.trim().slice(0, 120);
      return {
        outputText: `[Preview] Predicted LLM response for: "${preview || "(empty prompt)"}"`,
        text: `[Preview] Predicted LLM response for: "${preview || "(empty prompt)"}"`,
      };
    }

    case "httpRequest": {
      const method = String(data.method ?? "GET");
      const url = resolvedInputs.url || String(data.url ?? "");
      return {
        statusCode: 200,
        responseText: JSON.stringify({ mock: true, method, url, data: {} }),
        text: JSON.stringify({ mock: true, method, url, data: {} }),
      };
    }

    case "ifElse": {
      const inputText = resolvedInputs.conditionInput || "";
      const field = String(data.field ?? "");
      const operator = String(data.operator ?? "equals");
      const value = String(data.value ?? "");
      let result = false;
      const fieldValue = field ? extractField(inputText, field) : inputText;
      switch (operator) {
        case "equals": result = fieldValue === value; break;
        case "notEquals": result = fieldValue !== value; break;
        case "contains": result = fieldValue.includes(value); break;
        case "notContains": result = !fieldValue.includes(value); break;
        case "gt": result = Number(fieldValue) > Number(value); break;
        case "lt": result = Number(fieldValue) < Number(value); break;
        case "isEmpty": result = fieldValue.trim() === ""; break;
        case "isNotEmpty": result = fieldValue.trim() !== ""; break;
      }
      return {
        text: inputText,
        result: String(result),
        conditionResult: result,
        truePath: result,
        falsePath: !result,
      };
    }

    case "dataTransform": {
      const inputText = resolvedInputs.transformInput || "";
      const operation = String(data.operation ?? "jsonParse");
      const template = String(data.template ?? "");
      let transformed = inputText;
      switch (operation) {
        case "uppercase": transformed = inputText.toUpperCase(); break;
        case "lowercase": transformed = inputText.toLowerCase(); break;
        case "trim": transformed = inputText.trim(); break;
        case "template": transformed = template.replace(/\{\{input\}\}/g, inputText); break;
        case "jsonParse":
          try { transformed = JSON.stringify(JSON.parse(inputText), null, 2); } catch { transformed = inputText; }
          break;
        case "jsonStringify": transformed = JSON.stringify(inputText); break;
        case "base64Encode": transformed = btoa(inputText); break;
        case "extractField": {
          try {
            const parsed = JSON.parse(inputText);
            const keys = template.split(".");
            let current: unknown = parsed;
            for (const key of keys) {
              if (current && typeof current === "object") {
                current = (current as Record<string, unknown>)[key];
              } else { current = undefined; break; }
            }
            transformed = current !== undefined ? (typeof current === "string" ? current : JSON.stringify(current)) : "";
          } catch { transformed = inputText; }
          break;
        }
      }
      return { text: transformed };
    }

    case "cropImage": {
      const imgUrl = resolvedInputs.imageUrl || String(data.imageUrl ?? "");
      return {
        output: imgUrl
          ? `https://mock.nextflow.dev/cropped-preview.jpg`
          : "https://mock.nextflow.dev/crop-placeholder.jpg",
      };
    }

    case "extractFrame":
      return { output: "https://mock.nextflow.dev/frame-preview.jpg" };

    case "notification": {
      const msg = resolvedInputs.message || String(data.message ?? "");
      return { text: `[Preview] Notification: ${msg || "(empty)"}`, status: "simulated" };
    }

    default:
      return { text: "[Preview] Simulated output" };
  }
}

function extractField(text: string, field: string): string {
  try {
    const parsed = JSON.parse(text);
    const keys = field.split(".");
    let current: unknown = parsed;
    for (const key of keys) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[key];
      } else { current = undefined; break; }
    }
    return current !== undefined ? String(current) : "";
  } catch {
    return text;
  }
}
