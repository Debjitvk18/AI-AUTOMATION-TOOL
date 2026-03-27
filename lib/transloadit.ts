import crypto from "node:crypto";

function signParams(paramsStr: string, secret: string): string {
  return crypto.createHmac("sha384", secret).update(paramsStr).digest("hex");
}

/**
 * Upload a buffer via Transloadit assembly (template must accept raw upload).
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

  const json = (await res.json()) as {
    ok?: string;
    error?: string;
    message?: string;
    results?: Record<string, { ssl_url?: string; url?: string }[]>;
    assembly_ssl_url?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? json.message ?? `Transloadit HTTP ${res.status}`);
  }

  const results = json.results;
  if (results) {
    for (const steps of Object.values(results)) {
      for (const item of steps ?? []) {
        if (item.ssl_url) return item.ssl_url;
        if (item.url) return item.url;
      }
    }
  }
  if (json.assembly_ssl_url) return json.assembly_ssl_url;

  throw new Error("Transloadit response did not include a file URL");
}
