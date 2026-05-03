import type { Edge, Node } from "@xyflow/react";
import { nanoid } from "nanoid";
import { HANDLE, isValidEdge } from "@/lib/handles";
import { topologicalLayers, wouldCreateCycle } from "@/lib/graph";
import { nodeTypeIdSchema, type NodeTypeId } from "@/lib/node-types";

type GraphJson = {
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asJsonString(value: unknown, fallback = "{}"): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function defaultNodeData(type: NodeTypeId): Record<string, unknown> {
  switch (type) {
    case "text":
      return { text: "" };
    case "uploadImage":
      return { url: "" };
    case "uploadVideo":
      return { url: "" };
    case "llm":
      return {
        provider: "gemini",
        apiKey: "",
        model: "gemini-2.5-flash",
        systemPrompt: "",
        userMessage: "",
        lastOutput: "",
      };
    case "cropImage":
      return {
        imageUrl: "",
        xPercent: 0,
        yPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
      };
    case "extractFrame":
      return { videoUrl: "", timestamp: "0" };
    case "httpRequest":
      return { method: "GET", url: "", headers: "{}", body: "", lastResponse: "" };
    case "ifElse":
      return { field: "", operator: "equals", value: "", lastResult: "" };
    case "dataTransform":
      return { operation: "jsonParse", template: "", lastOutput: "" };
    case "webhookTrigger":
      return { hookId: "", lastPayload: "" };
    case "notification":
      return { notifType: "webhook", webhookUrl: "", message: "", lastStatus: "" };
    case "scheduleTrigger":
      return { cron: "0 * * * *", description: "Every hour", lastRun: "" };
    case "manualTrigger":
      return { inputData: "{}", lastOutput: "" };
    case "loop":
      return {};
  }
}

function normalizeNodeType(rawType: unknown): string {
  const type = typeof rawType === "string" ? rawType : "";
  if (type === "runLLM") return "llm";
  if (type === "sendNotification") return "notification";
  return type;
}

function getConfig(data: unknown): Record<string, unknown> {
  const record = asRecord(data);
  const config = asRecord(record.config);
  return Object.keys(config).length > 0 ? config : record;
}

function normalizeNodeData(type: NodeTypeId, rawData: unknown, nodeId: string): Record<string, unknown> {
  const record = asRecord(rawData);
  const config = getConfig(rawData);
  const label = asString(record.label || config.label);
  const base = { ...defaultNodeData(type), ...(label ? { label } : {}) };

  switch (type) {
    case "text":
      return {
        ...base,
        text: asString(config.text),
      };
    case "uploadImage":
      return {
        ...base,
        url: asString(config.url || config.image_url),
      };
    case "uploadVideo":
      return {
        ...base,
        url: asString(config.url || config.video_url),
      };
    case "llm":
      return {
        ...base,
        provider: asString(config.provider, "gemini"),
        apiKey: asString(config.apiKey || config.api_key),
        model: asString(config.model, "gemini-2.5-flash"),
        systemPrompt: asString(config.systemPrompt || config.system_prompt),
        userMessage: asString(config.userMessage || config.user_message),
        lastOutput: asString(config.lastOutput || config.output_text),
      };
    case "cropImage":
      return {
        ...base,
        imageUrl: asString(config.imageUrl || config.image_url),
        xPercent: asNumber(config.xPercent ?? config.x, 0),
        yPercent: asNumber(config.yPercent ?? config.y, 0),
        widthPercent: asNumber(config.widthPercent ?? config.width, 100),
        heightPercent: asNumber(config.heightPercent ?? config.height, 100),
      };
    case "extractFrame":
      return {
        ...base,
        videoUrl: asString(config.videoUrl || config.video_url),
        timestamp: asString(config.timestamp, "0"),
      };
    case "httpRequest":
      return {
        ...base,
        method: asString(config.method, "GET").toUpperCase(),
        url: asString(config.url),
        headers: asJsonString(config.headers, "{}"),
        body: asString(config.body),
        lastResponse: asString(config.lastResponse || config.response),
      };
    case "ifElse":
      return {
        ...base,
        field: asString(config.field),
        operator: asString(config.operator, "equals"),
        value: asString(config.value),
        lastResult: asString(config.lastResult),
      };
    case "dataTransform":
      return {
        ...base,
        operation: asString(config.operation, "jsonParse"),
        template: asString(config.template),
        lastOutput: asString(config.lastOutput),
      };
    case "webhookTrigger":
      return {
        ...base,
        hookId: asString(config.hookId || config.hook_id, `hook-${nodeId}-${nanoid(6)}`),
        lastPayload: asString(config.lastPayload),
      };
    case "notification":
      return {
        ...base,
        notifType: asString(config.notifType || config.type, "webhook"),
        webhookUrl: asString(config.webhookUrl || config.webhook_url),
        message: asString(config.message),
        lastStatus: asString(config.lastStatus),
      };
    case "scheduleTrigger":
      return {
        ...base,
        cron: asString(config.cron, "0 * * * *"),
        description: asString(config.description, "Every hour"),
        lastRun: asString(config.lastRun),
      };
    case "manualTrigger":
      return {
        ...base,
        inputData: asJsonString(config.inputData || config.input || config.payload, "{}"),
        lastOutput: asString(config.lastOutput),
      };
    case "loop":
      return base;
  }
}

function defaultSourceHandle(type: NodeTypeId): string | undefined {
  switch (type) {
    case "text":
      return HANDLE.textOut;
    case "uploadImage":
      return HANDLE.imageOut;
    case "uploadVideo":
      return HANDLE.videoOut;
    case "llm":
      return HANDLE.llmOut;
    case "cropImage":
      return HANDLE.cropOut;
    case "extractFrame":
      return HANDLE.extractOut;
    case "httpRequest":
      return HANDLE.httpOut;
    case "dataTransform":
      return HANDLE.transformOut;
    case "webhookTrigger":
      return HANDLE.webhookOut;
    case "notification":
      return HANDLE.notificationOut;
    case "scheduleTrigger":
      return HANDLE.scheduleOut;
    case "manualTrigger":
      return HANDLE.triggerOut;
    default:
      return undefined;
  }
}

function defaultTargetHandle(type: NodeTypeId): string | undefined {
  switch (type) {
    case "cropImage":
      return HANDLE.cropImageIn;
    case "extractFrame":
      return HANDLE.extractVideo;
    case "httpRequest":
      return HANDLE.httpUrlIn;
    case "ifElse":
      return HANDLE.conditionIn;
    case "dataTransform":
      return HANDLE.transformIn;
    case "notification":
      return HANDLE.notificationIn;
    default:
      return undefined;
  }
}

function normalizeSourceHandle(type: NodeTypeId, rawHandle: unknown): string | undefined {
  const handle = typeof rawHandle === "string" ? rawHandle : "";
  if (!handle) return defaultSourceHandle(type);

  switch (type) {
    case "text":
      if (handle === "text") return HANDLE.textOut;
      break;
    case "uploadImage":
      if (handle === "image_url") return HANDLE.imageOut;
      break;
    case "uploadVideo":
      if (handle === "video_url") return HANDLE.videoOut;
      break;
    case "llm":
      if (handle === "output_text") return HANDLE.llmOut;
      break;
    case "extractFrame":
      if (handle === "image_url") return HANDLE.extractOut;
      break;
    case "cropImage":
      if (handle === "image_url") return HANDLE.cropOut;
      break;
    case "httpRequest":
      if (handle === "output_text" || handle === "response") return HANDLE.httpOut;
      break;
    case "dataTransform":
      if (handle === "text" || handle === "output_text") return HANDLE.transformOut;
      break;
    case "notification":
      if (handle === "message" || handle === "status") return HANDLE.notificationOut;
      break;
  }

  return handle;
}

function normalizeTargetHandle(type: NodeTypeId, rawHandle: unknown): string | undefined {
  const handle = typeof rawHandle === "string" ? rawHandle : "";
  if (!handle) return defaultTargetHandle(type);

  switch (type) {
    case "llm":
      if (handle === "system_prompt") return HANDLE.systemPrompt;
      if (handle === "user_message") return HANDLE.userMessage;
      if (handle === "images") return HANDLE.images;
      break;
    case "cropImage":
      if (handle === "image_url") return HANDLE.cropImageIn;
      if (handle === "x") return HANDLE.cropX;
      if (handle === "y") return HANDLE.cropY;
      if (handle === "width") return HANDLE.cropW;
      if (handle === "height") return HANDLE.cropH;
      break;
    case "extractFrame":
      if (handle === "video_url") return HANDLE.extractVideo;
      if (handle === "timestamp") return HANDLE.extractTs;
      break;
    case "httpRequest":
      if (handle === "url") return HANDLE.httpUrlIn;
      if (handle === "body") return HANDLE.httpBodyIn;
      break;
    case "ifElse":
      if (handle === "condition") return HANDLE.conditionIn;
      break;
    case "dataTransform":
      if (handle === "input") return HANDLE.transformIn;
      break;
    case "notification":
      if (handle === "message") return HANDLE.notificationIn;
      break;
  }

  return handle;
}

export function normalizeGraphJson(input: unknown): GraphJson {
  const record = asRecord(input);
  const rawNodes = Array.isArray(record.nodes) ? record.nodes : [];
  const rawEdges = Array.isArray(record.edges) ? record.edges : [];
  const viewportRecord = asRecord(record.viewport);

  const nodes: Node[] = rawNodes.map((rawNode, index) => {
    const nodeRecord = asRecord(rawNode);
    const typeResult = nodeTypeIdSchema.safeParse(normalizeNodeType(nodeRecord.type));
    const type = typeResult.success ? typeResult.data : "text";
    const id = asString(nodeRecord.id, `node-${index + 1}`);
    const position = asRecord(nodeRecord.position);

    return {
      id,
      type,
      position: {
        x: asNumber(position.x, 160 + index * 220),
        y: asNumber(position.y, 120),
      },
      data: normalizeNodeData(type, nodeRecord.data, id),
    };
  });

  const nodeTypeById = new Map(nodes.map((node) => [node.id, node.type as NodeTypeId]));
  const edges: Edge[] = rawEdges.map((rawEdge, index) => {
    const edgeRecord = asRecord(rawEdge);
    const source = asString(edgeRecord.source);
    const target = asString(edgeRecord.target);
    const sourceType = nodeTypeById.get(source);
    const targetType = nodeTypeById.get(target);

    return {
      id: asString(edgeRecord.id, `edge-${index + 1}`),
      source,
      target,
      sourceHandle: sourceType
        ? normalizeSourceHandle(sourceType, edgeRecord.sourceHandle)
        : asString(edgeRecord.sourceHandle),
      targetHandle: targetType
        ? normalizeTargetHandle(targetType, edgeRecord.targetHandle)
        : asString(edgeRecord.targetHandle),
      type: "animatedPurple",
      animated: true,
    };
  });

  return {
    nodes,
    edges,
    viewport:
      typeof viewportRecord.x === "number" &&
      typeof viewportRecord.y === "number" &&
      typeof viewportRecord.zoom === "number"
        ? {
            x: viewportRecord.x,
            y: viewportRecord.y,
            zoom: viewportRecord.zoom,
          }
        : { x: 0, y: 0, zoom: 1 },
  };
}

export function validateGraphJson(graph: GraphJson): { ok: true } {
  const { nodes, edges } = graph;
  if (nodes.length === 0) {
    throw new Error("Graph must contain at least one node");
  }

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id) throw new Error("Every node must have an id");
    if (nodeIds.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    const parsedType = nodeTypeIdSchema.safeParse(node.type);
    if (!parsedType.success) throw new Error(`Unsupported node type: ${String(node.type)}`);
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    const sourceNode = nodesById.get(edge.source);
    const targetNode = nodesById.get(edge.target);
    if (!sourceNode || !targetNode) {
      throw new Error(`Edge ${edge.id} references a missing node`);
    }
    if (
      !isValidEdge(
        sourceNode.type as NodeTypeId,
        edge.sourceHandle,
        targetNode.type as NodeTypeId,
        edge.targetHandle,
      )
    ) {
      throw new Error(`Edge ${edge.id} uses incompatible handles`);
    }
    if (wouldCreateCycle(nodes, edges.filter((e) => e.id !== edge.id), edge)) {
      throw new Error(`Edge ${edge.id} creates a cycle`);
    }
  }

  topologicalLayers(
    nodes.map((node) => node.id),
    edges,
  );

  if (nodes.length > 1) {
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) adjacency.set(node.id, new Set());
    for (const edge of edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }

    const visited = new Set<string>();
    const queue = [nodes[0]!.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }

    if (visited.size !== nodes.length) {
      throw new Error("Graph contains disconnected nodes");
    }
  }

  return { ok: true };
}
