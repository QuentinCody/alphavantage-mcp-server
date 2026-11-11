import type { ApiEndpoint, ParamDef, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";
const symbol: ParamDef = {name: "symbol", type: "string", required: true, description: "Equity/ETF ticker, e.g. IBM or QQQ"};
const contract: ParamDef = {name: "contract", type: "string", required: false, description: "Exact US option contract ID; omitted returns the chain"};
const expiration: ParamDef = {name: "expiration", type: "string", required: false, description: "YYYY-MM-DD expiration filter; realtime requires a current/future expiration"};
export const intelligenceEndpoints: ApiEndpoint[] = [
  {method: "GET", path: "/news-sentiment", category: "intelligence", summary: "NEWS_SENTIMENT: article-level and ticker-level sentiment with publisher/time context", queryParams: [
    {name: "tickers", type: "string", required: false, description: "Comma-separated symbols matched simultaneously (AND), including CRYPTO:BTC or FOREX:USD"},
    {name: "topics", type: "string", required: false, description: "Comma-separated AND topics, e.g. life_sciences,earnings"},
    {name: "time_from", type: "string", required: false, description: "UTC YYYYMMDDTHHMM publication start"},
    {name: "time_to", type: "string", required: false, description: "UTC YYYYMMDDTHHMM publication end; omit for current time"},
    {name: "sort", type: "string", required: false, description: "LATEST, EARLIEST or RELEVANCE", default: "LATEST"},
    {name: "limit", type: "number", required: false, description: "1–1000, no documented cursor/offset. Hitting the cap requires narrower windows, not an invented next page.", default: 50},
  ]},
  {method: "GET", path: "/earnings-call-transcript", category: "intelligence", summary: "EARNINGS_CALL_TRANSCRIPT: fiscal-quarter transcript with speaker/turn sentiment", queryParams: [symbol, {name: "quarter", type: "string", required: true, description: "Fiscal quarter YYYYQ1–YYYYQ4 since 2010Q1; not a publication timestamp"}]},
  {method: "GET", path: "/realtime-options", category: "options", summary: "REALTIME_OPTIONS: premium chain/contract snapshot; requires realtime options entitlement", queryParams: [symbol, contract, expiration, {name: "require_greeks", type: "boolean", required: false, description: "Request Greeks and implied volatility", default: false}]},
  {method: "GET", path: "/historical-options", category: "options", summary: "HISTORICAL_OPTIONS: premium historical chain including Greeks/IV", queryParams: [symbol, contract, expiration, {name: "date", type: "string", required: false, description: "Trading date YYYY-MM-DD since 2008; omit for previous session. Use explicit date for historical research."}]},
  {method: "GET", path: "/insider-transactions", category: "ownership", summary: "INSIDER_TRANSACTIONS: insider transaction records with original dates, quantities and transaction categories", queryParams: [symbol, {name: "from", type: "string", required: false, description: "YYYY-MM-DD lower transaction-date filter; not a filing-availability filter"}]},
  {method: "GET", path: "/institutional-holdings", category: "ownership", summary: "INSTITUTIONAL_HOLDINGS: institutional ownership/holdings for an equity; preserve reporting/filing context", queryParams: [symbol]},
  {method: "GET", path: "/etf-profile", category: "ownership", summary: "ETF_PROFILE: ETF metrics, allocations and constituent holdings; provider snapshot is not historical point-in-time ownership", queryParams: [symbol]},
  {method: "GET", path: "/raw", category: "utility", summary: "Explicit Alpha Vantage function read; no implicit default function or credential overrides", queryParams: [{name: "function", type: "string", required: true, description: "Exact provider function name. Pass documented scalar parameters; JSON only. Newly cataloged functions receive the same validation as their named routes."}]},
];
export const intelligenceWorkflows: WorkflowRecipe[] = [
  {title: "Read bounded life-sciences news with source and ticker sentiment", keywords: ["news", "sentiment", "life_sciences", "earnings", "publication"], description: "Retrieve one explicit publication window. Preserve full publisher/article/ticker context and inspect limit warnings; sentiment labels are provider-derived signals rather than factual conclusions. Capped results do not prove complete coverage or historical availability.", code: `return await api.get("/news-sentiment", {topics: "life_sciences", time_from: "20260901T0000", time_to: "20260927T2359", sort: "EARLIEST", limit: 100});`},
  {title: "Keep transcript, insider and institutional ownership timelines separate", keywords: ["transcript", "insider", "institutional", "quarter", "ownership"], description: "Run three bounded-purpose reads and retain their separate native dates/fields, including complete staged source handles. Fiscal quarter, transaction date and holdings reporting period are not public availability timestamps. Stop on access/entitlement or staging errors; do not infer positions from transaction flows.", code: `const requests = [
  {path: "/earnings-call-transcript", params: {symbol: "IBM", quarter: "2025Q4"}},
  {path: "/insider-transactions", params: {symbol: "IBM", from: "2026-01-01"}},
  {path: "/institutional-holdings", params: {symbol: "IBM"}},
];
const sources = [];
for (const request of requests) {
  const result = await api.get(request.path, request.params);
  sources.push({request, result});
  if (result.__api_error || result.__stage_error) return {sources, complete: false};
}
return {sources, point_in_time_availability_verified: false};`},
  {title: "Retrieve a historical option chain with an explicit trading date", keywords: ["options", "historical", "Greeks", "expiration", "premium"], description: "Requires historical-options entitlement. Keep contract IDs, expiration, observation dates, raw values and units/context; never substitute an artificial demo snapshot or current chain. Add a documented contract/expiration filter to narrow large responses.", code: `return await api.get("/historical-options", {symbol: "IBM", date: "2025-09-26"});`},
];
