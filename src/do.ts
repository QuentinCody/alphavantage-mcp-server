import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class AvDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
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
