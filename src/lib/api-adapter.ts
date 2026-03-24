import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { avFetch } from "./http";

// Map virtual path prefixes to AV function names
const PATH_TO_FUNCTION: Record<string, string> = {
    "/quote": "GLOBAL_QUOTE",
    "/search": "SYMBOL_SEARCH",
    "/overview": "OVERVIEW",
    "/income-statement": "INCOME_STATEMENT",
    "/balance-sheet": "BALANCE_SHEET",
    "/cash-flow": "CASH_FLOW",
    "/earnings": "EARNINGS",
    "/listing-status": "LISTING_STATUS",
    "/earnings-calendar": "EARNINGS_CALENDAR",
    "/ipo-calendar": "IPO_CALENDAR",
    "/daily": "TIME_SERIES_DAILY_ADJUSTED",
    "/weekly": "TIME_SERIES_WEEKLY_ADJUSTED",
    "/monthly": "TIME_SERIES_MONTHLY_ADJUSTED",
    "/intraday": "TIME_SERIES_INTRADAY",
    "/sma": "SMA",
    "/ema": "EMA",
    "/rsi": "RSI",
    "/macd": "MACD",
    "/bbands": "BBANDS",
    "/stoch": "STOCH",
    "/real-gdp": "REAL_GDP",
    "/gdp-per-capita": "REAL_GDP_PER_CAPITA",
    "/treasury-yield": "TREASURY_YIELD",
    "/federal-funds-rate": "FEDERAL_FUNDS_RATE",
    "/cpi": "CPI",
    "/inflation": "INFLATION",
    "/retail-sales": "RETAIL_SALES",
    "/durables": "DURABLES",
    "/unemployment": "UNEMPLOYMENT",
    "/nonfarm-payroll": "NONFARM_PAYROLL",
    "/wti": "WTI",
    "/brent": "BRENT",
    "/natural-gas": "NATURAL_GAS",
    "/copper": "COPPER",
    "/aluminum": "ALUMINUM",
    "/wheat": "WHEAT",
    "/corn": "CORN",
    "/cotton": "COTTON",
    "/sugar": "SUGAR",
    "/coffee": "COFFEE",
};

let envApiKey: string | undefined;

export function setAvApiKey(key: string | undefined) {
    envApiKey = key;
}

export function createAvApiFetch(): ApiFetchFn {
    return async (request) => {
        const params = { ...(request.params as Record<string, unknown> || {}) };

        // Check if path directly maps to a known function
        const functionName = PATH_TO_FUNCTION[request.path];

        if (functionName) {
            // Use the mapped function name
            const response = await avFetch(functionName, params, { apiKey: envApiKey });
            if (!response.ok) {
                const errorBody = await response.text().catch(() => response.statusText);
                const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
                    status: number;
                    data: unknown;
                };
                error.status = response.status;
                error.data = errorBody;
                throw error;
            }
            const data = await response.json();
            return { status: response.status, data };
        }

        // If path is /raw or no mapping, use function param directly
        const fn = (params.function as string) || "GLOBAL_QUOTE";
        delete params.function;

        const response = await avFetch(fn, params, { apiKey: envApiKey });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => response.statusText);
            const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
