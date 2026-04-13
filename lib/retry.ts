export type RetryBackoffType = "none" | "fixed" | "exponential";

export type RetryPolicy = {
  enabled: boolean;
  maxAttempts: number;
  backoffType: RetryBackoffType;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  enabled: false,
  maxAttempts: 1,
  backoffType: "none",
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: "",
};

export function parseRetryPolicy(nodeData: unknown): RetryPolicy {
  if (!nodeData || typeof nodeData !== "object") return { ...DEFAULT_RETRY_POLICY };
  
  const raw = (nodeData as any).retryPolicy;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RETRY_POLICY };

  return {
    enabled: Boolean(raw.enabled),
    maxAttempts: Math.max(1, Math.min(10, Number(raw.maxAttempts) || 1)),
    backoffType: ["none", "fixed", "exponential"].includes(raw.backoffType) 
      ? (raw.backoffType as RetryBackoffType) 
      : "none",
    initialDelayMs: Math.max(100, Number(raw.initialDelayMs) || 1000),
    maxDelayMs: Math.max(100, Number(raw.maxDelayMs) || 30000),
    retryableErrors: String(raw.retryableErrors || ""),
  };
}

export function computeDelay(policy: RetryPolicy, attempt: number): number {
  if (!policy.enabled || policy.backoffType === "none") return 0;
  if (policy.backoffType === "fixed") return policy.initialDelayMs;
  
  // Exponential backoff
  const delay = policy.initialDelayMs * Math.pow(2, attempt - 1);
  return Math.min(delay, policy.maxDelayMs);
}

export function isRetryableError(policy: RetryPolicy, errorMessage: string): boolean {
  if (!policy.enabled || policy.maxAttempts <= 1) return false;
  
  const filters = policy.retryableErrors
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);
    
  if (filters.length === 0) return true; // Empty means retry all errors

  const lcMsg = errorMessage.toLowerCase();
  return filters.some(f => lcMsg.includes(f.toLowerCase()));
}
