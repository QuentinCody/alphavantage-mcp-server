import {afterEach, expect, it, vi} from "vitest";
import {McpServer} from "@bio-mcp/shared/mcp";
import {createApiProxyTool} from "@bio-mcp/shared/tools/api-proxy";
import {registerCodeMode} from "./code-mode";
import {registerGetSchema} from "./get-schema";
import {registerQueryData} from "./query-data";
import {avCatalog} from "../spec/catalog";
import {createAvApiFetch} from "../lib/api-adapter";
const json = (data: unknown) => new Response(JSON.stringify(data));
afterEach(() => vi.unstubAllGlobals());
it("registers both aliases and returns both fields on success and error", async () => {
  const server = new McpServer({name: "fixture", version: "1"});
  registerCodeMode(server, {CODE_MODE_LOADER: {get: () => ({})}} as unknown as Parameters<typeof registerCodeMode>[1]);
  registerQueryData(server, {}); registerGetSchema(server, {});
  const tools = (server as unknown as {_registeredTools: Record<string, {handler: (args: unknown, extra: unknown) => Promise<unknown>}>})._registeredTools;
  for (const suffix of ["search", "execute", "query_data", "get_schema"]) { expect(tools[`av_${suffix}`]).toBeDefined(); expect(tools[`mcp_av_${suffix}`]).toBeDefined(); }
  expect(await tools.av_search.handler({query: "ownership", category: "workflows", max_results: 5}, {})).toMatchObject({content: expect.any(Array), structuredContent: {success: true}});
  expect(await tools.mcp_av_query_data.handler({data_access_id: "av_fixture", sql: "SELECT 1"}, {})).toMatchObject({isError: true, content: expect.any(Array), structuredContent: expect.any(Object)});
});
it("stages native transcript turns and fiscal-quarter provenance intact", async () => {
  const raw = {symbol: "IBM", quarter: "2025Q4", transcript: [{speaker: "Fixture CEO", content: "α".repeat(20000), sentiment: "0.100"}]};
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => json(raw)));
  const stored: unknown[] = [];
  const namespace = {idFromName: (name: string) => name, get: () => ({fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      stored.push((await request.json() as {data: unknown}).data);
      return json({success: true, tables_created: ["transcript"], total_rows: 1, input_rows: 1, table_row_counts: {transcript: 1}});
    }
    return json({success: true, schema: {tables: {transcript: {columns: [{name: "content"}]}}}});
  }})} as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({apiFetch: createAvApiFetch("fixture-key"), catalog: avCatalog, doNamespace: namespace, stagingPrefix: "av", maxInlineBytes: 30 * 1024});
  expect(await proxy.handler({method: "GET", path: "/earnings-call-transcript", params: {symbol: "IBM", quarter: "2025Q4"}}, {sql: () => []})).toMatchObject({__staged: true, data_access_id: expect.any(String)});
  expect(JSON.parse(stored[0] as string)).toMatchObject({...raw, _mcp: {requested_quarter: "2025Q4", point_in_time_availability_verified: false}});
  expect(JSON.stringify(stored)).not.toContain("fixture-key");
});
it("provider access notices propagate as API errors rather than empty market observations", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({Information: "Subscription access required"})));
  const proxy = createApiProxyTool({apiFetch: createAvApiFetch("fixture-key"), catalog: avCatalog, stagingPrefix: "av"});
  expect(await proxy.handler({method: "GET", path: "/news-sentiment", params: {tickers: "IBM"}}, {sql: () => []})).toMatchObject({__api_error: true, incomplete: true, data: {code: "PROVIDER_NOTICE", upstream_http_status: 200}});
});
