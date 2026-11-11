export function fail(message: string, status = 400, data?: unknown): never { throw Object.assign(new Error(message), {status, data}); }
export const intelligenceFunctions: Record<string, string> = {
  "/news-sentiment": "NEWS_SENTIMENT", "/earnings-call-transcript": "EARNINGS_CALL_TRANSCRIPT",
  "/realtime-options": "REALTIME_OPTIONS", "/historical-options": "HISTORICAL_OPTIONS",
  "/insider-transactions": "INSIDER_TRANSACTIONS", "/institutional-holdings": "INSTITUTIONAL_HOLDINGS", "/etf-profile": "ETF_PROFILE",
};
const allowed: Record<string, string[]> = {
  NEWS_SENTIMENT: ["tickers", "topics", "time_from", "time_to", "sort", "limit"],
  EARNINGS_CALL_TRANSCRIPT: ["symbol", "quarter"], REALTIME_OPTIONS: ["symbol", "require_greeks", "contract", "expiration", "datatype"],
  HISTORICAL_OPTIONS: ["symbol", "date", "contract", "expiration", "datatype"], INSIDER_TRANSACTIONS: ["symbol", "from"],
  INSTITUTIONAL_HOLDINGS: ["symbol"], ETF_PROFILE: ["symbol"],
};
function date(value: unknown, key: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(`${key} must be a valid YYYY-MM-DD date`);
}
export function intelligenceParams(fn: string, input: Record<string, unknown>) {
  const params = {...input};
  if (!allowed[fn]) return params;
  for (const key of Object.keys(params)) if (!allowed[fn].includes(key)) fail(`Unsupported ${fn} parameter: ${key}`);
  if (fn !== "NEWS_SENTIMENT" && (typeof params.symbol !== "string" || !params.symbol.trim() || params.symbol.length > 100)) fail("symbol is required");
  if (fn === "NEWS_SENTIMENT") {
    validateNewsParams(params);
  }
  if (fn === "EARNINGS_CALL_TRANSCRIPT" && (typeof params.quarter !== "string" || !/^\d{4}Q[1-4]$/.test(params.quarter) || params.quarter < "2010Q1")) fail("quarter must be YYYYQ1–YYYYQ4 since 2010Q1");
  for (const key of ["date", "expiration", "from"]) if (params[key] !== undefined) date(params[key], key);
  if (params.require_greeks !== undefined && ![true, false, "true", "false"].includes(params.require_greeks as boolean | string)) fail("require_greeks must be true or false");
  if (params.datatype !== undefined && params.datatype !== "json") fail("Intelligence/options routes use JSON to retain typed provider metadata");
  return params;
}
function validateNewsParams(params: { [x: string]: unknown; }) {
  for (const key of ["tickers", "topics"]) if (params[key] !== undefined && (typeof params[key] !== "string" || !(params[key] as string).trim())) fail(`${key} must be a comma-separated string (AND matching)`);
  params.limit ??= 50;
  if (typeof params.limit !== "number" || !Number.isInteger(params.limit) || params.limit < 1 || params.limit > 1000) fail("News limit must be 1–1000");
  if (params.sort !== undefined && !["LATEST", "EARLIEST", "RELEVANCE"].includes(String(params.sort))) fail("Invalid news sort");
  for (const key of ["time_from", "time_to"]) if (params[key] !== undefined) {
    const value = params[key];
    if (typeof value !== "string" || !/^\d{8}T\d{4}$/.test(value)) fail(`${key} must be YYYYMMDDTHHMM in UTC`);
    date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, key);
    if (Number(value.slice(9, 11)) > 23 || Number(value.slice(11, 13)) > 59) fail(`Invalid ${key} time`);
  }
  if (params.time_from && params.time_to && String(params.time_from) > String(params.time_to)) fail("time_from must not follow time_to");
}

export function inspectIntelligence(fn: string, data: Record<string, unknown>, params: Record<string, unknown>) {
  if (!allowed[fn]) return;
  const field = fn === "NEWS_SENTIMENT" ? "feed" : fn === "EARNINGS_CALL_TRANSCRIPT" ? "transcript" : fn === "ETF_PROFILE" ? "holdings" : "data";
  const observedCollection = Array.isArray(data[field]);
  const capped = fn === "NEWS_SENTIMENT" && observedCollection && (data[field] as unknown[]).length >= Number(params.limit);
  const completeness = { complete: false, ...(observedCollection ? { returned: (data[field] as unknown[]).length } : {}),
    truncation: { reason: capped ? "upstream_cap" as const : "unknown" as const,
      detail: capped ? "News reached the requested limit; narrow the publication window. No continuation is documented." : "This response does not establish full dataset coverage or historical public availability." } };
  return {completeness, response_schema_verified: false, observed_collection: observedCollection ? field : null, requested_date: params.date ?? null, requested_quarter: params.quarter ?? null,
    news_limit_reached: fn === "NEWS_SENTIMENT" ? (Array.isArray(data.feed) ? data.feed.length >= Number(params.limit) : null) : null,
    complete_dataset_verified: false, point_in_time_availability_verified: false,
    note: "Preserve provider dates, attribution, raw numeric strings and sentiment context. Article publication, fiscal quarter, transaction date, reporting period and retrieval time are different. A response is not proof of historical public availability or complete coverage. No undocumented pagination is inferred."};
}
