/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({ RpcTarget: class {}, DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));
import { AvDataDO } from "./do";

const databases: DatabaseSync[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
async function store(data: unknown) {
  const database = new DatabaseSync(":memory:"); databases.push(database);
  let ready: Promise<unknown> = Promise.resolve();
  const exec = (sql: string, ...args: SQLInputValue[]) => {
    const rows = database.prepare(sql).all(...args);
    return { toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]() };
  };
  const ctx = { blockConcurrencyWhile: (run: () => Promise<unknown>) => { ready = run(); return ready; },
    storage: { sql: { exec }, transactionSync: (run: () => unknown) => {
      database.exec("BEGIN"); try { const result = run(); database.exec("COMMIT"); return result; }
      catch (error) { database.exec("ROLLBACK"); throw error; }
    } } };
  // This test fixture implements only the Durable Object storage interfaces used here.
  const instance = new AvDataDO(ctx as unknown as ConstructorParameters<typeof AvDataDO>[0], {} as ConstructorParameters<typeof AvDataDO>[1]);
  await ready;
  const result = await instance.fetch(new Request("https://fixture/process", { method: "POST", body: JSON.stringify({ data }) }));
  expect(await result.json()).toMatchObject({ success: true });
  return database;
}

const wrapped = (fn: string, field: string | null, native: Record<string, unknown>) => ({ ...native,
  _mcp: { observed_collection: field, provenance: { function: fn, raw_json: JSON.stringify(native) } } });
it.each([["NEWS_SENTIMENT", "feed"], ["EARNINGS_CALL_TRANSCRIPT", "transcript"], ["REALTIME_OPTIONS", "data"],
  ["HISTORICAL_OPTIONS", "data"], ["INSIDER_TRANSACTIONS", "data"], ["INSTITUTIONAL_HOLDINGS", "data"], ["ETF_PROFILE", "holdings"]])(
  "retains ordered %s rows, duplicate IDs and numeric string tokens", async (fn, field) => {
    const rows = [{ _rowid: 7, id: "0001", value: "9007199254740993", price: "0.0100", sentiment: null, nested: [{_rowid: 7, keep: "001"}], MCP_SOURCE_INDEX: "native", PRICE: "separate-case" },
      { _rowid: 7, id: "0001", value: "None", price: "-0.00", sentiment: "0.200", nested: [] }];
    const database = await store(wrapped(fn, field, { [field]: rows }));
    const result = database.prepare("SELECT mcp_source_index,mcp_source_collection,mcp_native_json,id,value,price FROM av_records ORDER BY mcp_source_index").all();
    expect(result.map(row => JSON.parse(String(row.mcp_native_json)))).toEqual(rows);
    expect(result.map(row => [row.id,row.value,row.price])).toEqual(rows.map(row => [row.id,row.value,row.price]));
    expect(result.map(row => row.mcp_source_index)).toEqual([0,1]);
    expect(result.every(row => row.mcp_source_collection === field)).toBe(true);
  });
it("keeps an unknown holdings envelope as one native record without inventing collection fields", async () => {
  const native = { provider_specific: { period: "2025-12-31", shares: "0001", holdings: [{_rowid: 1, value: "001"}] }, _mcp: {original: true} };
  const database = await store(wrapped("INSTITUTIONAL_HOLDINGS", null, native));
  const row = database.prepare("SELECT mcp_source_collection,mcp_native_json FROM av_records").get();
  expect(row?.mcp_source_collection).toBe("$");
  expect(JSON.parse(String(row?.mcp_native_json))).toEqual(native);
});
it("materializes restaged SQL without native _rowid collisions", async () => {
  const rows = [{_rowid:7,price:"0.0100",native:{repeated:[1,1]}},{_rowid:7,price:null}];
  const database=await store({content:[],structuredContent:{success:true,data:{rows,sql:"SELECT * FROM av_records"}}});
  expect(database.prepare("SELECT native_json FROM query_rows ORDER BY row_index").all().map(row=>JSON.parse(String(row.native_json)))).toEqual(rows);
});
