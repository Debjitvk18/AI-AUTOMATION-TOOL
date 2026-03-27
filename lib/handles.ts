import type { NodeTypeId } from "@/lib/node-types";

export type PortKind = "text" | "image" | "video";

export const HANDLE = {
  textOut: "text-out",
  imageOut: "image-out",
  videoOut: "video-out",
  systemPrompt: "system_prompt",
  userMessage: "user_message",
  images: "images",
  llmOut: "outputText",
  cropImageIn: "image_url",
  cropX: "x_percent",
  cropY: "y_percent",
  cropW: "width_percent",
  cropH: "height_percent",
  cropOut: "output",
  extractVideo: "video_url",
  extractTs: "timestamp",
  extractOut: "output",
} as const;

export function sourceHandlePortKind(
  nodeType: NodeTypeId,
  handleId: string | null | undefined,
): PortKind | null {
  if (!handleId) return null;
  if (handleId === HANDLE.textOut) return "text";
  if (handleId === HANDLE.imageOut) return "image";
  if (handleId === HANDLE.videoOut) return "video";
  if (handleId === HANDLE.llmOut) return "text";
  if (handleId === HANDLE.cropOut) return "image";
  if (handleId === HANDLE.extractOut) return "image";
  return null;
}

export function targetHandleAccepts(
  nodeType: NodeTypeId,
  handleId: string | null | undefined,
): PortKind | "image[]" | null {
  if (!handleId) return null;
  switch (nodeType) {
    case "llm":
      if (handleId === HANDLE.systemPrompt || handleId === HANDLE.userMessage) return "text";
      if (handleId === HANDLE.images) return "image[]";
      return null;
    case "cropImage":
      if (handleId === HANDLE.cropImageIn) return "image";
      if (
        handleId === HANDLE.cropX ||
        handleId === HANDLE.cropY ||
        handleId === HANDLE.cropW ||
        handleId === HANDLE.cropH
      )
        return "text";
      return null;
    case "extractFrame":
      if (handleId === HANDLE.extractVideo) return "video";
      if (handleId === HANDLE.extractTs) return "text";
      return null;
    default:
      return null;
  }
}

export function isValidEdge(
  sourceNodeType: NodeTypeId,
  sourceHandle: string | null | undefined,
  targetNodeType: NodeTypeId,
  targetHandle: string | null | undefined,
): boolean {
  const outKind = sourceHandlePortKind(sourceNodeType, sourceHandle);
  const accepts = targetHandleAccepts(targetNodeType, targetHandle);
  if (!outKind || !accepts) return false;
  if (accepts === "image[]") return outKind === "image";
  return outKind === accepts;
}
