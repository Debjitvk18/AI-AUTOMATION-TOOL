import crypto from "node:crypto";

function signParams(paramsStr: string, secret: string): string {
  const hash = crypto.createHmac("sha384", secret).update(paramsStr).digest("hex");
  return `sha384:${hash}`;
}

/** Try to extract a file URL from Transloadit assembly JSON. */
function extractUrlFromAssembly(json: TransloaditAssemblyResponse): string | null {
  const results = json.results;
  if (results) {
    for (const steps of Object.values(results)) {
      for (const item of steps ?? []) {
        if (item.ssl_url) return item.ssl_url;
        if (item.url) return item.url;
      }
    }
  }
  // Fallback: some templates put the uploaded file info in uploads array
  if (json.uploads && json.uploads.length > 0) {
    const u = json.uploads[0];
    if (u.ssl_url) return u.ssl_url;
    if (u.url) return u.url;
  }
  return null;
}

type TransloaditAssemblyResponse = {
  ok?: string;
  error?: string;
  message?: string;
  results?: Record<string, { ssl_url?: string; url?: string }[]>;
  uploads?: { ssl_url?: string; url?: string }[];
  assembly_ssl_url?: string;
  assembly_url?: string;
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

/**
 * Upload a buffer via Transloadit assembly (template must accept raw upload).
 * Polls for completion since assemblies are async.
 * Returns the first SSL URL from assembly results, or throws.
 */
export async function uploadBufferToTransloadit(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const key = process.env.TRANSLOADIT_AUTH_KEY;
  const secret = process.env.TRANSLOADIT_AUTH_SECRET;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID;
  if (!key || !secret || !templateId) {
    throw new Error(
      "Transloadit is not configured (TRANSLOADIT_AUTH_KEY, TRANSLOADIT_AUTH_SECRET, TRANSLOADIT_TEMPLATE_ID)",
    );
  }

  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const paramsObj = {
    auth: { key, expires },
    template_id: templateId,
  };
  const paramsStr = JSON.stringify(paramsObj);
  const signature = signParams(paramsStr, secret);

  const form = new FormData();
  form.append("params", paramsStr);
  form.append("signature", signature);
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: contentType }),
    filename,
  );

  const res = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: form,
  });

  let json = (await res.json()) as TransloaditAssemblyResponse;

  if (!res.ok) {
    throw new Error(json.error ?? json.message ?? `Transloadit HTTP ${res.status}`);
  }

  // If assembly already completed, try to extract URL immediately
  if (json.ok === "ASSEMBLY_COMPLETED") {
    const url = extractUrlFromAssembly(json);
    if (url) return url;
  }

  // Assembly is still processing — poll until completed
  const pollUrl = json.assembly_ssl_url || json.assembly_url;
  if (!pollUrl) {
    // No poll URL and no results — nothing we can do
    const url = extractUrlFromAssembly(json);
    if (url) return url;
    throw new Error("Transloadit response did not include a file URL or poll URL");
  }

  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(pollUrl);
    json = (await pollRes.json()) as TransloaditAssemblyResponse;

    if (json.error) {
      throw new Error(`Transloadit assembly error: ${json.error} — ${json.message ?? ""}`);
    }

    if (json.ok === "ASSEMBLY_COMPLETED") {
      const url = extractUrlFromAssembly(json);
      if (url) return url;
      // Completed but no URL found — break and throw below
      break;
    }

    // If still ASSEMBLY_UPLOADING or ASSEMBLY_EXECUTING, keep polling
  }

  // Final attempt
  const url = extractUrlFromAssembly(json);
  if (url) return url;

  throw new Error("Transloadit assembly timed out or did not return a file URL");
}
