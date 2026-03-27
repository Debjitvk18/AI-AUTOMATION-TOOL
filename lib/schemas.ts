import { z } from "zod";
import { runScopeSchema } from "@/lib/node-types";

export const graphJsonSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  graphJson: graphJsonSchema,
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  graphJson: graphJsonSchema.optional(),
});

export const createRunSchema = z.object({
  graphJson: graphJsonSchema,
  scope: runScopeSchema,
  targetNodeIds: z.array(z.string()).optional(),
});
