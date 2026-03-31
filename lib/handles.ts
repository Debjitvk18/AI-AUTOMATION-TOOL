import type { NodeTypeId } from "@/lib/node-types";

export type PortKind = "text" | "image" | "video";

export const HANDLE = {
  // --- existing ---
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
  // --- HTTP Request ---
  httpUrlIn: "http-url-in",
  httpBodyIn: "http-body-in",
  httpOut: "http-response-out",
  // --- If/Else ---
  conditionIn: "condition-input",
  trueOut: "true-out",
  falseOut: "false-out",
  // --- Data Transform ---
  transformIn: "transform-input",
  transformOut: "transform-out",
  // --- Webhook Trigger ---
  webhookOut: "webhook-out",
  // --- Notification ---
  notificationIn: "notification-input",
  notificationOut: "notification-out",
  // --- Schedule Trigger ---
  scheduleOut: "schedule-out",
  // --- Manual Trigger ---
  triggerOut: "trigger-out",
} as const;

export function sourceHandlePortKind(
  nodeType: NodeTypeId,
  handleId: string | null | undefined,
): PortKind | null {
  if (!handleId) return null;
  // Existing
  if (handleId === HANDLE.textOut) return "text";
  if (handleId === HANDLE.imageOut) return "image";
  if (handleId === HANDLE.videoOut) return "video";
  if (handleId === HANDLE.llmOut) return "text";
  if (handleId === HANDLE.cropOut) return "image";
  if (handleId === HANDLE.extractOut) return "image";
  // New nodes — all output text
  if (handleId === HANDLE.httpOut) return "text";
  if (handleId === HANDLE.trueOut) return "text";
  if (handleId === HANDLE.falseOut) return "text";
  if (handleId === HANDLE.transformOut) return "text";
  if (handleId === HANDLE.webhookOut) return "text";
  if (handleId === HANDLE.notificationOut) return "text";
  if (handleId === HANDLE.scheduleOut) return "text";
  if (handleId === HANDLE.triggerOut) return "text";
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
    // New nodes
    case "httpRequest":
      if (handleId === HANDLE.httpUrlIn || handleId === HANDLE.httpBodyIn) return "text";
      return null;
    case "ifElse":
      if (handleId === HANDLE.conditionIn) return "text";
      return null;
    case "dataTransform":
      if (handleId === HANDLE.transformIn) return "text";
      return null;
    case "notification":
      if (handleId === HANDLE.notificationIn) return "text";
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
