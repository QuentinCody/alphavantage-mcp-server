import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";
import { intelligenceFunctions } from "./lib/intelligence";

const record = (data: unknown): data is Record<string, unknown> => data !== null && typeof data === "object" && !Array.isArray(data);
function unwrap(value: unknown): unknown {
  return record(value) && Array.isArray(value.content) && record(value.structuredContent) && "data" in value.structuredContent
    ? value.structuredContent.data : value;
}
function intelligenceRows(value: unknown) {
  const data = unwrap(value);
  if (!record(data) || !record(data._mcp) || !record(data._mcp.provenance)
    || !Object.values(intelligenceFunctions).includes(String(data._mcp.provenance.function))) return;
  const collection = data._mcp.observed_collection;
  if (typeof collection === "string" && Array.isArray(data[collection])) return { collection, rows: data[collection] as unknown[] };
  // Unknown provider envelopes remain one source record, never an inferred holdings table.
  const native = typeof data._mcp.provenance.raw_json === "string"
    ? JSON.parse(data._mcp.provenance.raw_json.replace(/^\uFEFF/, "")) : data;
  return { collection: "$", rows: [native] };
}

export class AvDataDO extends RestStagingDO {
    protected getTabularData(value: unknown): unknown {
        const data = unwrap(value);
        if (record(data) && typeof data.sql === "string" && Array.isArray(data.rows)) {
            return { query_rows: data.rows.map((native, row_index) => ({ row_index, native_json: JSON.stringify(native) })) };
        }
        const source = intelligenceRows(data);
        if (!source) return data;
        return { av_records: source.rows.map((native, mcp_source_index) => {
            const row: Record<string, unknown> = { mcp_source_index, mcp_source_collection: source.collection, mcp_native_json: JSON.stringify(native) };
            const names = new Set(["_rowid", ...Object.keys(row)]);
            // Nested values retain their JSON types in mcp_native_json, including reserved field names.
            for (const [key, value] of Object.entries(record(native) ? native : {})) {
                if (value !== null && typeof value === "object" || names.has(key.toLowerCase())) continue;
                names.add(key.toLowerCase()); row[key] = value;
            }
            return row;
        }) };
    }

    protected getSchemaHints(value: unknown): SchemaHints | undefined {
        const source = intelligenceRows(value);
        if (source) {
            const columnTypes: Record<string, string> = { mcp_native_json: "TEXT", mcp_source_collection: "TEXT" };
            for (const row of source.rows) if (record(row)) for (const [key, value] of Object.entries(row)) {
                if (typeof value === "string") columnTypes[key] = "TEXT";
            }
            columnTypes.mcp_source_index = "INTEGER";
            return { tableName: "av_records", indexes: ["mcp_source_index"], columnTypes };
        }
        const data = unwrap(value);
        if (!data || typeof data !== "object") return undefined;

        const obj = data as Record<string, unknown>;

        // Time series data (daily, weekly, monthly)
        // Keys like "Time Series (Daily)", "Weekly Adjusted Time Series", etc.
        for (const key of Object.keys(obj)) {
            if (key.toLowerCase().includes("time series")) {
                return {
                    tableName: "time_series",
                    indexes: ["date"],
                };
            }
        }

        // Company overview / fundamentals
        if (obj.Symbol && obj.AssetType) {
            return {
                tableName: "fundamentals",
                indexes: ["Symbol", "Sector", "Industry"],
            };
        }

        // Earnings data
        if (obj.annualEarnings || obj.quarterlyEarnings) {
            return {
                tableName: "earnings",
                indexes: ["fiscalDateEnding", "reportedDate"],
            };
        }

        // Income statement, balance sheet, cash flow
        if (obj.annualReports || obj.quarterlyReports) {
            return {
                tableName: "financial_reports",
                indexes: ["fiscalDateEnding"],
            };
        }

        // Technical indicators (SMA, EMA, RSI, etc.)
        for (const key of Object.keys(obj)) {
            if (key.startsWith("Technical Analysis")) {
                return {
                    tableName: "technical_indicators",
                    indexes: ["date"],
                };
            }
        }

        // Search results
        if (obj.bestMatches && Array.isArray(obj.bestMatches)) {
            return {
                tableName: "search_results",
                indexes: ["symbol", "name"],
            };
        }

        // Economic indicators
        if (Array.isArray(obj.data)) {
            return {
                tableName: "economic_data",
                indexes: ["date"],
            };
        }

        return undefined;
    }
}
