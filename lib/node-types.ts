import { z } from "zod";

export const nodeTypeIdSchema = z.enum([
  "text",
  "uploadImage",
  "uploadVideo",
  "llm",
  "cropImage",
  "extractFrame",
]);

export type NodeTypeId = z.infer<typeof nodeTypeIdSchema>;

export const runScopeSchema = z.enum(["FULL", "PARTIAL", "SINGLE"]);

export type RunScope = z.infer<typeof runScopeSchema>;
