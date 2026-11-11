import {afterEach, expect, it, vi} from "vitest";
import {createAvApiFetch} from "./api-adapter";
import {intelligenceWorkflows} from "../spec/intelligence";
const key = "fixture-api-key-not-real";
const api = createAvApiFetch(key);
const query = {method: "GET" as const, path: "/news-sentiment", params: {tickers: "IBM,CRYPTO:BTC", topics: "life_sciences,earnings", time_from: "20260901T0000", time_to: "20260902T2359", limit: 1}};
// Synthetic contract examples. Provider demo replies may be access notices or artificial prices.
const news = {items: "1", sentiment_score_definition: "provider definition", feed: [{title: "Fixture article", url: "https://example.org/article", source: "Fixture publisher", time_published: "20260901T123456", overall_sentiment_score: 0.2, ticker_sentiment: [{ticker: "IBM", relevance_score: "0.900", ticker_sentiment_score: "-0.100"}], topics: [{topic: "Life Sciences", relevance_score: "1.0"}]}]};
const json = (value: unknown) => new Response(JSON.stringify(value));
function mock(value: unknown = news) { vi.stubGlobal("fetch", vi.fn().mockImplementation(() => json(value))); }
afterEach(() => vi.unstubAllGlobals());
it("preserves source/publication and per-ticker sentiment with explicit capped-query context", async () => {
  mock(); const result = await api(query);
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
  expect(url.pathname).toBe("/query"); expect(url.searchParams.get("function")).toBe("NEWS_SENTIMENT"); expect(url.searchParams.get("tickers")).toBe("IBM,CRYPTO:BTC"); expect(url.searchParams.get("apikey")).toBe(key);
  expect(result.data).toMatchObject({...news, _mcp: {news_limit_reached: true, complete_dataset_verified: false, point_in_time_availability_verified: false, provenance: {response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/)}}}); expect(JSON.stringify(result)).not.toContain(key);
});
it.each([
  ["/earnings-call-transcript", "EARNINGS_CALL_TRANSCRIPT", {symbol: "IBM", quarter: "2025Q4"}, {transcript: [{speaker: "Fixture CEO", title: "CEO", content: "Fixture turn", sentiment: "0.200"}]}],
  ["/realtime-options", "REALTIME_OPTIONS", {symbol: "IBM", require_greeks: true, contract: "IBM270115C00390000", expiration: "2027-01-15"}, {data: [{contractID: "IBM270115C00390000", strike: "390.00", implied_volatility: "0.23766", bid: "0.00", date: "2026-09-28"}]}],
  ["/historical-options", "HISTORICAL_OPTIONS", {symbol: "IBM", date: "2025-09-26"}, {data: [{date: "2025-09-26", expiration: "2025-10-17", volume: "9007199254740993", delta: "None"}]}],
  ["/insider-transactions", "INSIDER_TRANSACTIONS", {symbol: "IBM", from: "2026-01-01"}, {data: [{transaction_date: "2026-03-01", acquisition_or_disposal: "A", shares: "00100", share_price: "0.00", executive_title: "Director"}]}],
  ["/institutional-holdings", "INSTITUTIONAL_HOLDINGS", {symbol: "IBM"}, {provider_specific_shape: {period: "2025-12-31", filing_date: "2026-02-14", shares: "1000"}}],
  ["/etf-profile", "ETF_PROFILE", {symbol: "QQQ"}, {holdings: [{symbol: "IBM", weight: "0.001"}], net_assets: "1000000000"}],
])("maps %s and preserves its full native fields", async (path, fn, params, payload) => {
  mock(payload); const result = await api({method: "GET", path: path as string, params: params as Record<string, unknown>});
  expect(result.data).toMatchObject(payload as object); expect(result.data).toMatchObject({_mcp: {response_schema_verified: false, point_in_time_availability_verified: false}});
  expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).searchParams.get("function")).toBe(fn);
});
it.each(["Note", "Information", "Error Message"])("treats HTTP 200 %s as a provider refusal, including legacy routes", async field => {
  mock({[field]: `Access or quota issue for ${key}`});
  await expect(api(query)).rejects.toMatchObject({status: 502, data: {code: "PROVIDER_NOTICE", provider_field: field, upstream_http_status: 200, message: "Access or quota issue for [REDACTED]", data_access_verified: false}});
  await expect(api({method: "GET", path: "/quote", params: {symbol: "IBM"}})).rejects.toThrow("provider notice");
});
it("never exposes illustrative option rows as market data", async () => {
  // Reduced wording from the provider's documented demo example, observed 2026-09-28.
  mock({endpoint: "Realtime Options", message: "The sample data schema is artificial and for illustration purposes only", data: [{contractID: "fixture", last: "6.30"}]});
  const error = await api({method: "GET", path: "/realtime-options", params: {symbol: "IBM"}}).catch(error => error);
  expect(error).toMatchObject({status: 502, data: {code: "ILLUSTRATIVE_DATA", upstream_http_status: 200, data_access_verified: false}});
  expect(JSON.parse(error.data.text).data).toEqual([{contractID: "fixture", last: "6.30"}]);
});
it("requires host credentials instead of silently using demo or another instance's key", async () => {
  mock(); await expect(createAvApiFetch()(query)).rejects.toMatchObject({status: 401}); expect(fetch).not.toHaveBeenCalled();
  await api(query); await createAvApiFetch("second-fixture-key")(query); await api(query);
  expect(vi.mocked(fetch).mock.calls.map(c => new URL(String(c[0])).searchParams.get("apikey"))).toEqual([key, "second-fixture-key", key]);
});
it.each([{apikey: "override"}, {function: "GLOBAL_QUOTE"}, {limit: 1001}, {limit: 0}, {limit: "50"}, {sort: "random"}, {tickers: ["IBM", "MSFT"]}, {time_from: "20260230T0000"}, {time_to: "20260901T2460"}, {time_to: "20250801T0000"}, {offset: 50}])("rejects unsupported/invalid news input %# before network", async changes => {
  mock(); await expect(api({...query, params: {...query.params, ...changes}})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it.each([{}, {symbol: "IBM"}, {symbol: "IBM", quarter: "2026Q5"}, {symbol: "IBM", quarter: "2009Q4"}])("rejects invalid transcript selection %#", async params => {
  mock(); await expect(api({method: "GET", path: "/earnings-call-transcript", params})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it.each([{date: "bad"}, {expiration: "2027-02-30"}, {datatype: "csv"}, {limit: 10}])("rejects invalid historical-options controls %#", async params => {
  mock(); await expect(api({method: "GET", path: "/historical-options", params: {symbol: "IBM", ...params}})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it("does not silently substitute a quote for an unknown path", async () => { mock(); await expect(api({method: "GET", path: "/typo"})).rejects.toThrow("Unknown path"); expect(fetch).not.toHaveBeenCalled(); });
it("explicit raw functions share new-function validation and refusal handling", async () => {
  mock(); const result = await api({method: "GET", path: "/raw", params: {function: "NEWS_SENTIMENT", ...query.params}}); expect(result.data).toMatchObject(news);
  await expect(api({method: "GET", path: "/raw", params: {}})).rejects.toThrow("explicit function");
});
it("keeps native legacy quote envelopes", async () => { const native = {"Global Quote": {"05. price": "123.4500"}}; mock(native); expect((await api({method: "GET", path: "/quote", params: {symbol: "IBM"}})).data).toEqual(native); });
it("rejects function/key overrides even on legacy paths", async () => {
  mock(); await expect(api({method: "GET", path: "/quote", params: {symbol: "IBM", apikey: "bad"}})).rejects.toThrow("overridden"); await expect(api({...query, method: "POST"})).rejects.toThrow("GET reads"); expect(fetch).not.toHaveBeenCalled();
});
it("bounds bytes and sanitizes HTTP/network failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error(key)).mockResolvedValueOnce(new Response(key, {status: 403})).mockResolvedValueOnce(new Response("x".repeat(4*1024*1024+1))).mockResolvedValueOnce(new Response("csv,data")));
  await expect(api(query)).rejects.toThrow("failed or timed out"); await expect(api(query)).rejects.toMatchObject({status: 403, data: {text: "[REDACTED]"}}); await expect(api(query)).rejects.toThrow("4 MiB"); await expect(api(query)).rejects.toThrow("did not return JSON");
});
it("reports empty feeds without claiming complete coverage", async () => { mock({items: "0", feed: []}); expect((await api(query)).data).toMatchObject({feed: [], _mcp: {news_limit_reached: false, complete_dataset_verified: false}}); });
const run = (index: number, api: unknown) => new Function("api", `return (async()=>{${intelligenceWorkflows[index].code}})()`)(api);
it.each([{__api_error: true}, {__stage_error: true}])("ownership recipe stops on source errors %#", async handle => {
  const get = vi.fn().mockResolvedValue(handle); expect(await run(1, {get})).toMatchObject({sources: [{result: handle}], complete: false}); expect(get).toHaveBeenCalledTimes(1);
});
it("ownership recipe retains all three independent staged sources", async () => {
  const get = vi.fn().mockImplementation(async (path: string) => ({__staged: true, data_access_id: path}));
  const result = await run(1, {get});
  expect(result.sources).toHaveLength(3); expect(get).toHaveBeenCalledTimes(3);
  expect(result.sources.map((source: {result: {data_access_id: string}}) => source.result.data_access_id)).toEqual(["/earnings-call-transcript", "/insider-transactions", "/institutional-holdings"]);
  expect(result.point_in_time_availability_verified).toBe(false);
});
it("ownership recipe retains separate source queries and does not assign a shared as-of date", async () => {
  const get = vi.fn().mockResolvedValue({data: []}); const result = await run(1, {get}); expect(result.sources).toHaveLength(3); expect(result.point_in_time_availability_verified).toBe(false);
  expect(get.mock.calls[0][1]).toEqual({symbol: "IBM", quarter: "2025Q4"}); expect(get.mock.calls[1][1]).toEqual({symbol: "IBM", from: "2026-01-01"}); expect(get.mock.calls[2][1]).toEqual({symbol: "IBM"});
});
it("news/options recipes use explicit date windows without fabricated pagination", async () => {
  const get = vi.fn().mockResolvedValue({}); await run(0, {get}); await run(2, {get});
  expect(get.mock.calls[0][1]).toMatchObject({time_from: "20260901T0000", time_to: "20260927T2359", limit: 100}); expect(get.mock.calls[1]).toEqual(["/historical-options", {symbol: "IBM", date: "2025-09-26"}]);
});
