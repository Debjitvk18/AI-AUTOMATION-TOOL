/**
 * Workflow Node Auto-Repair Engine
 *
 * Analyzes failed node executions and produces SAFE, MINIMAL fixes.
 * Hard constraints:
 *   - Never change node type
 *   - Never introduce new nodes
 *   - Never remove required fields
 *   - Never hallucinate external APIs or fields
 *   - Returns NO_SAFE_FIX when uncertain
 */

// ─── Types ───────────────────────────────────────────────────────────

export type ErrorType =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "NETWORK_ERROR"
  | "LOGIC_ERROR"
  | "RATE_LIMIT"
  | "UNKNOWN";

export type RepairStatus = "FIX_APPLIED" | "NO_SAFE_FIX";

export interface RetryStrategy {
  should_retry: boolean;
  retry_delay_ms: number;
  max_retries: number;
}

export interface RepairFix {
  updated_inputs: Record<string, unknown>;
  changed_fields: string[];
  notes: string;
}

export interface RepairResult {
  status: RepairStatus;
  error_type: ErrorType;
  reasoning: string;
  fix: RepairFix | null;
  retry_strategy: RetryStrategy;
  confidence: number;
}

export interface FailureInput {
  nodeType: string;
  inputsJson: Record<string, unknown>;
  upstreamOutputs: Record<string, Record<string, unknown>>;
  error: string;
  edges?: Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
}

// ─── Error Classifier ────────────────────────────────────────────────

const AUTH_PATTERNS = [
  /401\s*unauthorized/i,
  /403\s*forbidden/i,
  /missing\s*api\s*key/i,
  /invalid\s*api\s*key/i,
  /authentication/i,
  /credentials/i,
  /api\s*key\s*missing/i,
];

const NETWORK_PATTERNS = [
  /timeout/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ETIMEDOUT/i,
  /network\s*error/i,
  /dns/i,
  /socket\s*hang\s*up/i,
  /abort/i,
  /ECONNRESET/i,
  /fetch\s*failed/i,
];

const RATE_LIMIT_PATTERNS = [
  /429/i,
  /rate\s*limit/i,
  /too\s*many\s*requests/i,
  /quota\s*exceeded/i,
  /resource\s*exhausted/i,
];

const VALIDATION_PATTERNS = [
  /missing\s*(field|input|param|required)/i,
  /is\s*required/i,
  /invalid\s*(url|input|value|format)/i,
  /cannot\s*be\s*empty/i,
  /url\s*missing/i,
  /parse\s*error/i,
  /invalid\s*json/i,
  /malformed/i,
  /expected\s*(string|number|object|array)/i,
];

export function classifyError(error: string): ErrorType {
  if (AUTH_PATTERNS.some((p) => p.test(error))) return "AUTH_ERROR";
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(error))) return "RATE_LIMIT";
  if (NETWORK_PATTERNS.some((p) => p.test(error))) return "NETWORK_ERROR";
  if (VALIDATION_PATTERNS.some((p) => p.test(error))) return "VALIDATION_ERROR";

  // Logic errors — transformation / processing failures
  if (/extract\s*error/i.test(error)) return "LOGIC_ERROR";
  if (/crop\s*failed/i.test(error)) return "LOGIC_ERROR";
  if (/unsupported\s*node\s*type/i.test(error)) return "LOGIC_ERROR";
  if (/empty\s*response/i.test(error)) return "LOGIC_ERROR";

  return "UNKNOWN";
}

// ─── Upstream Output Helpers ─────────────────────────────────────────

function findUpstreamText(upstreamOutputs: Record<string, Record<string, unknown>>): string | null {
  for (const nodeId of Object.keys(upstreamOutputs)) {
    const o = upstreamOutputs[nodeId]!;
    if (typeof o.text === "string" && o.text.trim()) return o.text;
    if (typeof o.outputText === "string" && o.outputText.trim()) return o.outputText;
    if (typeof o.responseText === "string" && o.responseText.trim()) return o.responseText;
  }
  return null;
}

function findUpstreamImageUrl(upstreamOutputs: Record<string, Record<string, unknown>>): string | null {
  for (const nodeId of Object.keys(upstreamOutputs)) {
    const o = upstreamOutputs[nodeId]!;
    if (typeof o.url === "string" && o.url.trim()) return o.url;
    if (typeof o.output === "string" && o.output.trim() && /^https?:\/\//i.test(o.output)) return o.output;
  }
  return null;
}

function findUpstreamVideoUrl(upstreamOutputs: Record<string, Record<string, unknown>>): string | null {
  for (const nodeId of Object.keys(upstreamOutputs)) {
    const o = upstreamOutputs[nodeId]!;
    if (typeof o.url === "string" && o.url.trim() && /video/i.test(String(o.mime ?? ""))) return o.url;
    if (typeof o.url === "string" && o.url.trim()) return o.url; // fallback
  }
  return null;
}

// ─── URL Repair Helpers ─────────────────────────────────────────────

function tryFixUrl(url: string): string | null {
  if (!url || !url.trim()) return null;
  let fixed = url.trim();

  // Add missing protocol
  if (/^[a-zA-Z0-9].*\.[a-zA-Z]{2,}/.test(fixed) && !fixed.startsWith("http")) {
    fixed = "https://" + fixed;
  }

  // Fix double protocol
  fixed = fixed.replace(/^(https?:\/\/)(https?:\/\/)/, "$1");

  // Remove trailing whitespace and control chars
  fixed = fixed.replace(/[\s\x00-\x1f]+$/, "");

  try {
    new URL(fixed);
    return fixed !== url.trim() ? fixed : null;
  } catch {
    return null;
  }
}

function clampPercent(value: unknown, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

// ─── Node-Type-Specific Fixers ───────────────────────────────────────

function fixLlmNode(input: FailureInput): Partial<RepairResult> {
  const { inputsJson, upstreamOutputs, error } = input;

  // Missing user message — try multiple fallback sources
  if (/user\s*message\s*is\s*required/i.test(error) || /user_?message/i.test(error)) {
    // Fallback 1: Map from upstream text outputs
    const upstreamText = findUpstreamText(upstreamOutputs);
    if (upstreamText) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, userMessage: upstreamText },
          changed_fields: ["userMessage"],
          notes: "Mapped userMessage from upstream text output",
        },
        confidence: 0.85,
      };
    }

    // Fallback 2: Use the node's own systemPrompt as userMessage
    const systemPrompt = String(inputsJson.systemPrompt ?? "").trim();
    if (systemPrompt) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, userMessage: systemPrompt, systemPrompt: "" },
          changed_fields: ["userMessage", "systemPrompt"],
          notes: "Moved systemPrompt to userMessage (LLM requires at least a user message)",
        },
        confidence: 0.7,
      };
    }

    // Fallback 3: Check any text-like field in inputsJson
    for (const key of Object.keys(inputsJson)) {
      const val = inputsJson[key];
      if (typeof val === "string" && val.trim().length > 0 && key !== "userMessage" && key !== "provider" && key !== "model" && key !== "apiKey") {
        return {
          status: "FIX_APPLIED",
          fix: {
            updated_inputs: { ...inputsJson, userMessage: val.trim() },
            changed_fields: ["userMessage"],
            notes: `Used "${key}" field value as userMessage fallback`,
          },
          confidence: 0.5,
        };
      }
    }

    return { status: "NO_SAFE_FIX", confidence: 0.0, fix: null };
  }

  // Missing API key — NO_SAFE_FIX (auth issue)
  if (/api\s*key/i.test(error)) {
    return { status: "NO_SAFE_FIX", confidence: 0.0, fix: null };
  }

  // Empty response — retry with slightly modified prompt
  if (/empty\s*response/i.test(error)) {
    const msg = String(inputsJson.userMessage ?? "");
    if (msg.trim()) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, userMessage: msg + "\n\nPlease provide a detailed response." },
          changed_fields: ["userMessage"],
          notes: "Appended clarification to prompt to avoid empty response",
        },
        retry_strategy: { should_retry: true, retry_delay_ms: 1000, max_retries: 2 },
        confidence: 0.5,
      };
    }
  }

  // Unsupported provider
  if (/unsupported.*provider/i.test(error)) {
    return { status: "NO_SAFE_FIX", confidence: 0.0, fix: null };
  }

  return {};
}

function fixHttpRequestNode(input: FailureInput): Partial<RepairResult> {
  const { inputsJson, upstreamOutputs, error } = input;

  // Missing or invalid URL
  if (/url\s*(is\s*required|missing)/i.test(error) || /invalid\s*url/i.test(error)) {
    const currentUrl = String(inputsJson.url ?? "");

    // Try to fix the current URL
    const fixedUrl = tryFixUrl(currentUrl);
    if (fixedUrl) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, url: fixedUrl },
          changed_fields: ["url"],
          notes: `Fixed malformed URL: "${currentUrl}" → "${fixedUrl}"`,
        },
        confidence: 0.8,
      };
    }

    // Try to get URL from upstream
    const text = findUpstreamText(upstreamOutputs);
    if (text && /^https?:\/\//i.test(text.trim())) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, url: text.trim() },
          changed_fields: ["url"],
          notes: "Mapped URL from upstream text output",
        },
        confidence: 0.7,
      };
    }

    return { status: "NO_SAFE_FIX", confidence: 0.0, fix: null };
  }

  // Invalid headers JSON
  if (/invalid\s*headers\s*json/i.test(error) || /json.*parse/i.test(error)) {
    return {
      status: "FIX_APPLIED",
      fix: {
        updated_inputs: { ...inputsJson, headers: "{}" },
        changed_fields: ["headers"],
        notes: "Reset malformed headers JSON to empty object",
      },
      confidence: 0.75,
    };
  }

  return {};
}

function fixCropImageNode(input: FailureInput): Partial<RepairResult> {
  const { inputsJson, upstreamOutputs, error } = input;

  // Missing image URL
  if (/image.*required/i.test(error) || /image\s*url\s*missing/i.test(error)) {
    const imgUrl = findUpstreamImageUrl(upstreamOutputs);
    if (imgUrl) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, imageUrl: imgUrl },
          changed_fields: ["imageUrl"],
          notes: "Mapped imageUrl from upstream image output",
        },
        confidence: 0.85,
      };
    }
    return { status: "NO_SAFE_FIX", confidence: 0.0, fix: null };
  }

  // Invalid crop percentages
  if (/crop\s*failed/i.test(error)) {
    const updated: Record<string, unknown> = { ...inputsJson };
    const changed: string[] = [];

    for (const [key, fallback] of [["xPercent", 0], ["yPercent", 0], ["widthPercent", 100], ["heightPercent", 100]] as const) {
      const original = inputsJson[key];
      const clamped = clampPercent(original, fallback);
      if (clamped !== Number(original)) {
        updated[key] = clamped;
        changed.push(key);
      }
    }

    if (changed.length > 0) {
      return {
        status: "FIX_APPLIED",
        fix: { updated_inputs: updated, changed_fields: changed, notes: "Clamped crop percentages to valid 0-100 range" },
        confidence: 0.7,
      };
    }
  }

  // Could not download source image
  if (/could\s*not\s*download/i.test(error)) {
    return {
      status: "FIX_APPLIED",
      fix: { updated_inputs: inputsJson, changed_fields: [], notes: "Source image download failed — retry may resolve transient issue" },
      retry_strategy: { should_retry: true, retry_delay_ms: 3000, max_retries: 2 },
      confidence: 0.4,
    };
  }

  return {};
}

function fixExtractFrameNode(input: FailureInput): Partial<RepairResult> {
  const { inputsJson, upstreamOutputs, error } = input;

  // Missing video URL
  if (/video\s*url\s*(is\s*required|missing)/i.test(error)) {
    const vidUrl = findUpstreamVideoUrl(upstreamOutputs);
    if (vidUrl) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, videoUrl: vidUrl },
          changed_fields: ["videoUrl"],
          notes: "Mapped videoUrl from upstream video output",
        },
        confidence: 0.8,
      };
    }
    return { status: "NO_SAFE_FIX", confidence: 0.0, fix: null };
  }

  // Invalid timestamp
  if (/invalid\s*timestamp/i.test(error)) {
    return {
      status: "FIX_APPLIED",
      fix: {
        updated_inputs: { ...inputsJson, timestamp: "0" },
        changed_fields: ["timestamp"],
        notes: "Reset invalid timestamp to 0 (start of video)",
      },
      confidence: 0.6,
    };
  }

  return {};
}

function fixNotificationNode(input: FailureInput): Partial<RepairResult> {
  const { inputsJson, upstreamOutputs, error } = input;

  // Missing webhook URL
  if (/webhook\s*url\s*(is\s*required|missing)/i.test(error)) {
    return { status: "NO_SAFE_FIX", confidence: 0.0, fix: null };
  }

  // Empty message
  if (/message/i.test(error) && /empty|required|missing/i.test(error)) {
    const text = findUpstreamText(upstreamOutputs);
    if (text) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, message: text },
          changed_fields: ["message"],
          notes: "Mapped message from upstream text output",
        },
        confidence: 0.8,
      };
    }
  }

  return {};
}

function fixDataTransformNode(input: FailureInput): Partial<RepairResult> {
  const { inputsJson, error } = input;

  // JSON parse error — try to escape
  if (/parse\s*error/i.test(error) || /invalid\s*json/i.test(error)) {
    const op = String(inputsJson.operation ?? "");
    if (op === "jsonParse") {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, operation: "trim" },
          changed_fields: ["operation"],
          notes: "Changed operation from jsonParse to trim since input is not valid JSON",
        },
        confidence: 0.5,
      };
    }
  }

  // Extract field error
  if (/extract\s*error/i.test(error)) {
    return {
      status: "FIX_APPLIED",
      fix: {
        updated_inputs: { ...inputsJson, operation: "jsonParse" },
        changed_fields: ["operation"],
        notes: "Changed to jsonParse to inspect raw structure before extraction",
      },
      confidence: 0.4,
    };
  }

  return {};
}

function fixIfElseNode(input: FailureInput): Partial<RepairResult> {
  const { inputsJson, upstreamOutputs, error } = input;

  // Empty condition input
  if (/empty|missing|required/i.test(error)) {
    const text = findUpstreamText(upstreamOutputs);
    if (text) {
      return {
        status: "FIX_APPLIED",
        fix: {
          updated_inputs: { ...inputsJson, _resolvedInput: text },
          changed_fields: ["_resolvedInput"],
          notes: "Upstream text available for condition evaluation",
        },
        confidence: 0.6,
      };
    }
  }

  return {};
}

// ─── Retry Strategy Calculator ───────────────────────────────────────

function computeRetryStrategy(errorType: ErrorType, confidence: number): RetryStrategy {
  switch (errorType) {
    case "AUTH_ERROR":
      return { should_retry: false, retry_delay_ms: 0, max_retries: 0 };
    case "RATE_LIMIT":
      return { should_retry: true, retry_delay_ms: 10000, max_retries: 3 };
    case "NETWORK_ERROR":
      return { should_retry: true, retry_delay_ms: 3000, max_retries: 3 };
    case "VALIDATION_ERROR":
      return confidence > 0.5
        ? { should_retry: true, retry_delay_ms: 500, max_retries: 2 }
        : { should_retry: false, retry_delay_ms: 0, max_retries: 0 };
    case "LOGIC_ERROR":
      return confidence > 0.5
        ? { should_retry: true, retry_delay_ms: 1000, max_retries: 1 }
        : { should_retry: false, retry_delay_ms: 0, max_retries: 0 };
    case "UNKNOWN":
    default:
      return { should_retry: false, retry_delay_ms: 0, max_retries: 0 };
  }
}

// ─── No-Fix Result Builder ───────────────────────────────────────────

function noSafeFix(errorType: ErrorType, reasoning: string): RepairResult {
  return {
    status: "NO_SAFE_FIX",
    error_type: errorType,
    reasoning,
    fix: null,
    retry_strategy: { should_retry: false, retry_delay_ms: 0, max_retries: 0 },
    confidence: 0.0,
  };
}

// ─── Main Entry Point ────────────────────────────────────────────────

export function analyzeNodeFailure(input: FailureInput): RepairResult {
  const { nodeType, inputsJson, error } = input;
  const errorType = classifyError(error);

  // Hard rule: auth errors are never auto-fixable
  if (errorType === "AUTH_ERROR") {
    return noSafeFix("AUTH_ERROR", `Authentication error detected: ${error}. User must provide valid credentials.`);
  }

  // Rate limits: always suggest retry with backoff, no input changes
  if (errorType === "RATE_LIMIT") {
    return {
      status: "FIX_APPLIED",
      error_type: "RATE_LIMIT",
      reasoning: "Rate limit detected. No input changes needed, but retry with backoff.",
      fix: {
        updated_inputs: inputsJson,
        changed_fields: [],
        notes: "No input changes — retry with exponential backoff",
      },
      retry_strategy: { should_retry: true, retry_delay_ms: 10000, max_retries: 3 },
      confidence: 0.9,
    };
  }

  // Network errors: suggest retry with delay
  if (errorType === "NETWORK_ERROR") {
    return {
      status: "FIX_APPLIED",
      error_type: "NETWORK_ERROR",
      reasoning: `Network error: ${error}. Transient issue likely resolved by retry.`,
      fix: {
        updated_inputs: inputsJson,
        changed_fields: [],
        notes: "No input changes — retry to resolve transient network issue",
      },
      retry_strategy: { should_retry: true, retry_delay_ms: 3000, max_retries: 3 },
      confidence: 0.7,
    };
  }

  // Upstream dependency failures — can't fix
  if (/upstream\s*dependency\s*failed/i.test(error)) {
    return noSafeFix(errorType, "Upstream node failed. Fix the upstream node first.");
  }

  // Node-type-specific fixers
  let partialResult: Partial<RepairResult> = {};

  switch (nodeType) {
    case "llm":
      partialResult = fixLlmNode(input);
      break;
    case "httpRequest":
      partialResult = fixHttpRequestNode(input);
      break;
    case "cropImage":
      partialResult = fixCropImageNode(input);
      break;
    case "extractFrame":
      partialResult = fixExtractFrameNode(input);
      break;
    case "notification":
      partialResult = fixNotificationNode(input);
      break;
    case "dataTransform":
      partialResult = fixDataTransformNode(input);
      break;
    case "ifElse":
      partialResult = fixIfElseNode(input);
      break;

    // Nodes that require user input — generally not auto-fixable
    case "text":
    case "uploadImage":
    case "uploadVideo":
    case "manualTrigger":
      if (/missing|required|empty/i.test(error)) {
        return noSafeFix(errorType, `${nodeType} requires user-provided content. Cannot auto-fix.`);
      }
      break;

    // Trigger nodes — rarely fail with fixable issues
    case "webhookTrigger":
    case "scheduleTrigger":
      break;

    case "loop":
      if (/nested\s*loop/i.test(error)) {
        return noSafeFix("LOGIC_ERROR", "Nested loops are not supported. Restructure the workflow.");
      }
      break;

    default:
      break;
  }

  // Build final result from partial
  if (partialResult.status === "NO_SAFE_FIX") {
    return noSafeFix(
      errorType,
      partialResult.reasoning ?? `Cannot auto-fix ${nodeType} failure: ${error}`,
    );
  }

  if (partialResult.status === "FIX_APPLIED" && partialResult.fix) {
    const confidence = partialResult.confidence ?? 0.5;
    return {
      status: "FIX_APPLIED",
      error_type: errorType,
      reasoning: partialResult.fix.notes,
      fix: partialResult.fix,
      retry_strategy: partialResult.retry_strategy ?? computeRetryStrategy(errorType, confidence),
      confidence,
    };
  }

  // Fallback: no fixer matched
  return noSafeFix(errorType, `No safe auto-fix available for ${nodeType} error: ${error}`);
}
