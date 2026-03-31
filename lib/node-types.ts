import { z } from "zod";

export const nodeTypeIdSchema = z.enum([
  "text",
  "uploadImage",
  "uploadVideo",
  "llm",
  "cropImage",
  "extractFrame",
  // n8n-style nodes
  "httpRequest",
  "ifElse",
  "dataTransform",
  "webhookTrigger",
  "notification",
  "scheduleTrigger",
  "manualTrigger",
]);

export type NodeTypeId = z.infer<typeof nodeTypeIdSchema>;

export const runScopeSchema = z.enum(["FULL", "PARTIAL", "SINGLE"]);

export type RunScope = z.infer<typeof runScopeSchema>;
