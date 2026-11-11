import { fail } from "./intelligence";

/** Fixed-host, single-attempt JSON reads. The deadline includes the complete body. */
export async function avFetch(functionName: string, params: Record<string, unknown>, opts?: {
  apiKey?: string; timeoutMs?: number; maxBytes?: number;
}) {
  const { url, apiKey, sourceUrl } = prepareAuthenticatedRequest(opts, functionName, params);
  const controller = new AbortController();
  const maxBytes = opts?.maxBytes ?? 4 * 1024 * 1024;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("deadline")); }, opts?.timeoutMs ?? 50_000);
  });
  try {
    try {
      const pending = Promise.resolve(fetch(url, { headers: { Accept: "application/json" }, redirect: "manual", signal: controller.signal })).then(value => {
        if (controller.signal.aborted) { void value.body?.cancel().catch(() => {}); throw new Error("deadline"); }
        return value;
      });
      response = await Promise.race([pending, expired]);
    } catch { fail("Alpha Vantage request failed or timed out", 502); }
    if (Number(response.headers.get("content-length")) > maxBytes) fail("Alpha Vantage response exceeds byte limit (default 4 MiB)", 502);
    reader = response.body?.getReader();
    const { digest, size, raw, original } = await readRedactedBody(reader, expired, maxBytes, apiKey);
    const provenance = { source_url: sourceUrl, function: functionName, request: params, retrieved_at: new Date().toISOString(),
      response_sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""),
      response_bytes: size, raw_json: raw, redacted: raw !== original };
    return decodeProviderResponse(response, raw, provenance);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
    else if (response) void response.body?.cancel().catch(() => {});
  }
}

function decodeProviderResponse(response: Response, raw: string, provenance: { source_url: string; function: string; request: Record<string, unknown>; retrieved_at: string; response_sha256: string; response_bytes: number; raw_json: string; redacted: boolean; }) {
  const evidence = {
    upstream_http_status: response.status, retry_after: response.headers.get("retry-after"),
    content_type: response.headers.get("content-type"), text: raw, provenance
  };
  if (response.status !== 200 || response.headers.has("content-range")) {
    fail(`Alpha Vantage HTTP ${response.status}: a complete HTTP 200 response is required`, response.status === 200 ? 502 : response.status, evidence);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw.replace(/^\uFEFF/, "")); }
  catch { fail("Alpha Vantage did not return JSON; CSV-only legacy functions require a separate CSV reader", 502, evidence); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("Invalid Alpha Vantage response", 502, evidence);
  const data = parsed as Record<string, unknown>;
  const notice = ["Error Message", "Note", "Information"].find(key => typeof data[key] === "string");
  const illustrative = typeof data.message === "string" && /artificial|illustrat(?:ion|ive)|sample data/i.test(data.message);
  if (notice || illustrative) {
    fail("Alpha Vantage returned a provider notice or illustrative data instead of validated market data", 502,
      {
        ...evidence, code: illustrative ? "ILLUSTRATIVE_DATA" : "PROVIDER_NOTICE", provider_field: notice ?? "message",
        message: data[notice ?? "message"], data_access_verified: false
      });
  }
  return { status: response.status, data, provenance };
}

async function readRedactedBody(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | undefined, expired: Promise<never>, maxBytes: number, apiKey: string) {
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (reader) {
      const { value, done } = await Promise.race([reader.read(), expired]); if (done) break;
      size += value.byteLength; if (size > maxBytes) fail("Response exceeds byte limit", 502);
      chunks.push(value);
    }
  } catch { fail("Alpha Vantage response unreadable, timed out or exceeds byte limit (default 4 MiB)", 502); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let raw: string;
  try { raw = (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? "\uFEFF" : "") + new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes); }
  catch { fail("Alpha Vantage returned invalid UTF-8", 502); }
  const original = raw;
  for (const value of new Set([apiKey, encodeURIComponent(apiKey), JSON.stringify(apiKey).slice(1, -1)])) raw = raw.split(value).join("[REDACTED]");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return { digest, size, raw, original };
}

function prepareAuthenticatedRequest(opts: { apiKey?: string; timeoutMs?: number; maxBytes?: number; } | undefined, functionName: string, params: Record<string, unknown>) {
  const apiKey = opts?.apiKey;
  if (!apiKey?.trim()) fail("ALPHAVANTAGE_API_KEY is required; demo responses do not establish data access", 401);
  if (!/^[A-Z0-9_]+$/.test(functionName)) fail("Use an explicit Alpha Vantage function name");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", functionName);
  for (const [key, value] of Object.entries(params)) {
    if (/^(?:function|api_?key|authorization|token)$/i.test(key)) fail("Credentials/function cannot be overridden in query parameters");
    if (value === undefined || value === null) continue;
    if (!["string", "number", "boolean"].includes(typeof value) || String(value).length > 4000 || typeof value === "number" && !Number.isFinite(value)) fail("Use bounded scalar Alpha Vantage parameters");
    url.searchParams.set(key, String(value));
  }
  if (url.toString().length > 16000) fail("Alpha Vantage query exceeds local URL limit");
  const sourceUrl = url.toString();
  url.searchParams.set("apikey", apiKey);
  return { url, apiKey, sourceUrl };
}
