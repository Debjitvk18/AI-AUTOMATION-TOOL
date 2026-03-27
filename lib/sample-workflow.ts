import type { Edge, Node } from "@xyflow/react";

/** Demo graph showcasing all six node types (positions are illustrative). */
export function getSampleGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "n-text-system",
      type: "text",
      position: { x: 40, y: 40 },
      data: { text: "You are a concise product copywriter." },
    },
    {
      id: "n-text-user",
      type: "text",
      position: { x: 40, y: 220 },
      data: { text: "Write a one-line tagline for a matte black water bottle." },
    },
    {
      id: "n-upload-image",
      type: "uploadImage",
      position: { x: 40, y: 400 },
      data: { url: "" },
    },
    {
      id: "n-llm",
      type: "llm",
      position: { x: 420, y: 120 },
      data: {
        model: "gemini-2.0-flash",
        systemPrompt: "",
        userMessage: "",
        lastOutput: "",
      },
    },
    {
      id: "n-crop",
      type: "cropImage",
      position: { x: 420, y: 420 },
      data: {
        imageUrl: "",
        xPercent: 0,
        yPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
      },
    },
    {
      id: "n-upload-video",
      type: "uploadVideo",
      position: { x: 40, y: 560 },
      data: { url: "" },
    },
    {
      id: "n-extract",
      type: "extractFrame",
      position: { x: 420, y: 620 },
      data: { videoUrl: "", timestamp: "0" },
    },
  ];

  const edges: Edge[] = [
    {
      id: "e1",
      source: "n-text-system",
      target: "n-llm",
      sourceHandle: "text-out",
      targetHandle: "system_prompt",
      type: "animatedPurple",
    },
    {
      id: "e2",
      source: "n-text-user",
      target: "n-llm",
      sourceHandle: "text-out",
      targetHandle: "user_message",
      type: "animatedPurple",
    },
    {
      id: "e3",
      source: "n-upload-image",
      target: "n-llm",
      sourceHandle: "image-out",
      targetHandle: "images",
      type: "animatedPurple",
    },
  ];

  return { nodes, edges };
}
