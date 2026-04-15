import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient({ log: ["error"] });

const BASE_URL = (process.env.SCHEDULER_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const POLL_MS = Number.parseInt(process.env.SCHEDULER_POLL_MS ?? "60000", 10);
const USE_UTC = String(process.env.SCHEDULER_USE_UTC ?? "true").toLowerCase() !== "false";
const RUN_ONCE = process.argv.includes("--once") || process.env.SCHEDULER_RUN_ONCE === "1";
const GLOBAL_SESSION_TOKEN = (process.env.SCHEDULER_SESSION_TOKEN ?? "").trim();
const USER_SESSION_TOKEN_MAP = parseUserSessionTokenMap(process.env.SCHEDULER_USER_SESSION_TOKENS);

const cronCache = new Map();
const lastTriggeredMinuteByNode = new Map();

let tickRunning = false;
let shuttingDown = false;

function parseUserSessionTokenMap(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === "string" && typeof value === "string" && value.trim().length > 0) {
        out[key] = value.trim();
      }
    }
    return out;
  } catch {
    console.warn("[scheduler] SCHEDULER_USER_SESSION_TOKENS is invalid JSON; ignoring.");
    return {};
  }
}

function getSessionTokenForUser(userId) {
  return USER_SESSION_TOKEN_MAP[userId] ?? GLOBAL_SESSION_TOKEN;
}

function parseGraphScheduleNodes(graphJson) {
  if (!graphJson || typeof graphJson !== "object" || Array.isArray(graphJson)) return [];
  const nodes = graphJson.nodes;
  if (!Array.isArray(nodes)) return [];

  const out = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const type = String(node.type ?? "");
    if (type !== "scheduleTrigger") continue;

    const nodeId = String(node.id ?? "").trim();
    if (!nodeId) continue;

    const data = node.data && typeof node.data === "object" && !Array.isArray(node.data) ? node.data : {};
    const cron = String(data.cron ?? "").trim();
    if (!cron) continue;

    out.push({ nodeId, cron });
  }

  return out;
}

function fullSet(min, max) {
  const set = new Set();
  for (let i = min; i <= max; i += 1) set.add(i);
  return set;
}

function addRangeWithStep(result, start, end, step, min, max) {
  const safeStart = Math.max(min, start);
  const safeEnd = Math.min(max, end);
  if (safeStart > safeEnd) return;
  for (let value = safeStart; value <= safeEnd; value += step) {
    result.add(value);
  }
}

function parseField(field, min, max) {
  if (!field) throw new Error("Empty cron field");
  const trimmed = field.trim();
  if (trimmed === "*") {
    return { wildcard: true, values: fullSet(min, max) };
  }

  const values = new Set();
  const items = trimmed.split(",");

  for (const rawItem of items) {
    const item = rawItem.trim();
    if (!item) throw new Error(`Invalid cron token in field: "${field}"`);

    const [rangePartRaw, stepPartRaw] = item.split("/");
    const rangePart = rangePartRaw?.trim();
    const step = stepPartRaw === undefined ? 1 : Number.parseInt(stepPartRaw.trim(), 10);
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`Invalid cron step "${stepPartRaw}" in field: "${field}"`);
    }

    if (rangePart === "*") {
      addRangeWithStep(values, min, max, step, min, max);
      continue;
    }

    if (rangePart.includes("-")) {
      const [startRaw, endRaw] = rangePart.split("-");
      const start = Number.parseInt((startRaw ?? "").trim(), 10);
      const end = Number.parseInt((endRaw ?? "").trim(), 10);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`Invalid cron range "${rangePart}" in field: "${field}"`);
      }
      addRangeWithStep(values, start, end, step, min, max);
      continue;
    }

    const single = Number.parseInt(rangePart, 10);
    if (!Number.isInteger(single)) {
      throw new Error(`Invalid cron value "${rangePart}" in field: "${field}"`);
    }
    if (single < min || single > max) {
      throw new Error(`Cron value out of range (${single}) in field: "${field}"`);
    }
    values.add(single);
  }

  if (values.size === 0) {
    throw new Error(`No values parsed for cron field: "${field}"`);
  }

  return { wildcard: false, values };
}

function parseCronExpression(expr) {
  const parts = String(expr ?? "").trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Expected 5 cron fields, got ${parts.length}: "${expr}"`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return {
    minute: parseField(minute, 0, 59),
    hour: parseField(hour, 0, 23),
    dayOfMonth: parseField(dayOfMonth, 1, 31),
    month: parseField(month, 1, 12),
    dayOfWeek: parseField(dayOfWeek, 0, 6),
  };
}

function getDateParts(date, useUtc) {
  if (useUtc) {
    return {
      minute: date.getUTCMinutes(),
      hour: date.getUTCHours(),
      dayOfMonth: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      dayOfWeek: date.getUTCDay(),
    };
  }

  return {
    minute: date.getMinutes(),
    hour: date.getHours(),
    dayOfMonth: date.getDate(),
    month: date.getMonth() + 1,
    dayOfWeek: date.getDay(),
  };
}

function matchesField(parsedField, value) {
  return parsedField.values.has(value);
}

function cronMatchesNow(parsedCron, now, useUtc) {
  const parts = getDateParts(now, useUtc);

  const minuteOk = matchesField(parsedCron.minute, parts.minute);
  const hourOk = matchesField(parsedCron.hour, parts.hour);
  const monthOk = matchesField(parsedCron.month, parts.month);
  const domOk = matchesField(parsedCron.dayOfMonth, parts.dayOfMonth);
  const dowOk = matchesField(parsedCron.dayOfWeek, parts.dayOfWeek);

  const dayOk =
    parsedCron.dayOfMonth.wildcard || parsedCron.dayOfWeek.wildcard
      ? domOk && dowOk
      : domOk || dowOk;

  return minuteOk && hourOk && monthOk && dayOk;
}

async function triggerWorkflowRun({ workflowId, userId, graphJson, scheduleNodeId }) {
  const sessionToken = getSessionTokenForUser(userId);
  if (!sessionToken) {
    console.warn(
      `[scheduler] Skipping workflow=${workflowId} node=${scheduleNodeId}: no scheduler session token for user ${userId}`,
    );
    return false;
  }

  const url = `${BASE_URL}/api/workflows/${encodeURIComponent(workflowId)}/runs`;
  const body = JSON.stringify({ graphJson, scope: "FULL" });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `__session=${sessionToken}`,
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(
      `[scheduler] Trigger failed workflow=${workflowId} node=${scheduleNodeId}: status=${response.status}, body=${text}`,
    );
    return false;
  }

  let runId = "";
  let triggerRunId = "";
  try {
    const parsed = JSON.parse(text);
    runId = String(parsed?.runId ?? "");
    triggerRunId = String(parsed?.triggerRunId ?? "");
  } catch {
    // ignore parse error and log partial success
  }

  console.log(
    `[scheduler] Triggered workflow=${workflowId} node=${scheduleNodeId} runId=${runId || "unknown"} triggerRunId=${triggerRunId || "unknown"}`,
  );
  return true;
}

async function tick() {
  if (tickRunning) {
    console.warn("[scheduler] Previous tick still running; skipping this interval.");
    return;
  }

  tickRunning = true;
  const now = new Date();
  const minuteSlot = Math.floor(now.getTime() / 60000);

  try {
    const workflows = await prisma.workflow.findMany({
      select: {
        id: true,
        userId: true,
        graphJson: true,
      },
    });

    let scheduleNodeCount = 0;
    let matchedCount = 0;
    let triggeredCount = 0;

    for (const workflow of workflows) {
      const scheduleNodes = parseGraphScheduleNodes(workflow.graphJson);
      if (scheduleNodes.length === 0) continue;

      scheduleNodeCount += scheduleNodes.length;

      for (const scheduleNode of scheduleNodes) {
        const cacheKey = `${workflow.id}:${scheduleNode.nodeId}:${scheduleNode.cron}`;
        const triggerKey = `${workflow.id}:${scheduleNode.nodeId}`;

        let parsedCron = cronCache.get(cacheKey);
        if (!parsedCron) {
          try {
            parsedCron = parseCronExpression(scheduleNode.cron);
            cronCache.set(cacheKey, parsedCron);
          } catch (error) {
            console.error(
              `[scheduler] Invalid cron workflow=${workflow.id} node=${scheduleNode.nodeId} cron="${scheduleNode.cron}": ${String(error)}`,
            );
            continue;
          }
        }

        if (!cronMatchesNow(parsedCron, now, USE_UTC)) continue;
        matchedCount += 1;

        if (lastTriggeredMinuteByNode.get(triggerKey) === minuteSlot) {
          continue;
        }

        const ok = await triggerWorkflowRun({
          workflowId: workflow.id,
          userId: workflow.userId,
          graphJson: workflow.graphJson,
          scheduleNodeId: scheduleNode.nodeId,
        });

        if (ok) {
          lastTriggeredMinuteByNode.set(triggerKey, minuteSlot);
          triggeredCount += 1;
        }
      }
    }

    const nowIso = now.toISOString();
    console.log(
      `[scheduler] Tick complete at ${nowIso} workflows=${workflows.length} scheduleNodes=${scheduleNodeCount} matched=${matchedCount} triggered=${triggeredCount}`,
    );
  } catch (error) {
    console.error(`[scheduler] Tick failed: ${String(error)}`);
  } finally {
    tickRunning = false;
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[scheduler] Received ${signal}. Shutting down...`);
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

async function main() {
  if (!Number.isFinite(POLL_MS) || POLL_MS <= 0) {
    throw new Error(`SCHEDULER_POLL_MS must be a positive integer, got: ${String(process.env.SCHEDULER_POLL_MS)}`);
  }

  console.log(
    `[scheduler] Starting. baseUrl=${BASE_URL} pollMs=${POLL_MS} timezone=${USE_UTC ? "UTC" : "local"} runOnce=${RUN_ONCE}`,
  );

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await tick();

  if (RUN_ONCE) {
    await prisma.$disconnect();
    return;
  }

  setInterval(() => {
    void tick();
  }, POLL_MS);
}

main().catch(async (error) => {
  console.error(`[scheduler] Fatal error: ${String(error)}`);
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(1);
  }
});
