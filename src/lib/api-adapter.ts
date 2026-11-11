import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { intelligenceFunctions, intelligenceParams, inspectIntelligence, fail } from "./intelligence";
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

export function createAvApiFetch(apiKey?: string): ApiFetchFn {
    return async request => {
        if (request.method !== "GET" || request.body !== undefined) fail("Alpha Vantage supports GET reads");
        const params = {...request.params};
        const mapped = intelligenceFunctions[request.path] ?? PATH_TO_FUNCTION[request.path];
        const fn = mapped ?? (request.path === "/raw" ? params.function : undefined);
        if (typeof fn !== "string" || !/^[A-Z0-9_]+$/.test(fn)) fail("Unknown path; use a catalog route or /raw with an explicit function");
        if (mapped && params.function !== undefined) fail("Mapped function cannot be overridden");
        delete params.function;
        const validated = intelligenceParams(fn, params);
        const result = await avFetch(fn, validated, {apiKey});
        const context = inspectIntelligence(fn, result.data, validated);
        return {status: result.status, ...(context ? {completeness: context.completeness, upstreamTotal: null} : {}),
            data: context ? {...result.data, _mcp: {...context, provenance: result.provenance}} : result.data};
    };
}
