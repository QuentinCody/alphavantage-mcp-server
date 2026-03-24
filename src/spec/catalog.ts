import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const avCatalog: ApiCatalog = {
    name: "Alpha Vantage",
    baseUrl: "https://www.alphavantage.co",
    version: "1.0",
    auth: "required",
    endpointCount: 30,
    notes:
        "- All endpoints use the same base: /query?function=X&apikey=KEY\n" +
        "- Code Mode virtual paths: /daily, /weekly, /monthly, /quote, /overview, etc.\n" +
        "- Time series: outputsize=compact (100 points) or full (20 years). Default: compact\n" +
        "- Free tier: 25 req/day, 5 req/min. Use demo key for testing\n" +
        "- Intraday intervals: 1min, 5min, 15min, 30min, 60min\n" +
        "- Technical indicators require: symbol, interval, time_period, series_type params\n" +
        "- Economic data and commodities return {data: [{date, value}]} arrays\n" +
        "- Error responses: {\"Note\": \"...\"} for rate limit, {\"Error Message\": \"...\"} for bad params",
    endpoints: [
        // --- Stock Prices ---
        {
            method: "GET",
            path: "/daily",
            summary: "Daily OHLCV + adjusted close prices, up to 20 years of history",
            category: "stock_prices",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker (e.g. AAPL, MSFT)" },
                { name: "outputsize", type: "string", required: false, description: "compact (100 points) or full (20+ years)", default: "compact" },
            ],
        },
        {
            method: "GET",
            path: "/weekly",
            summary: "Weekly adjusted time series (open, high, low, close, volume, dividend, split)",
            category: "stock_prices",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        {
            method: "GET",
            path: "/monthly",
            summary: "Monthly adjusted time series",
            category: "stock_prices",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        {
            method: "GET",
            path: "/intraday",
            summary: "Intraday OHLCV data at 1/5/15/30/60 min intervals (premium feature)",
            category: "stock_prices",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
                { name: "interval", type: "string", required: true, description: "Time interval: 1min, 5min, 15min, 30min, 60min" },
                { name: "outputsize", type: "string", required: false, description: "compact or full", default: "compact" },
            ],
        },
        {
            method: "GET",
            path: "/quote",
            summary: "Real-time quote: price, volume, change, change percent, latest trading day",
            category: "stock_prices",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        // --- Fundamentals ---
        {
            method: "GET",
            path: "/overview",
            summary: "Company profile: market cap, P/E, EPS, sector, industry, description, dividends",
            category: "fundamentals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        {
            method: "GET",
            path: "/income-statement",
            summary: "Annual + quarterly income statements (revenue, net income, EBITDA, etc.)",
            category: "fundamentals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        {
            method: "GET",
            path: "/balance-sheet",
            summary: "Annual + quarterly balance sheets (assets, liabilities, equity)",
            category: "fundamentals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        {
            method: "GET",
            path: "/cash-flow",
            summary: "Annual + quarterly cash flow statements (operating, investing, financing)",
            category: "fundamentals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        {
            method: "GET",
            path: "/earnings",
            summary: "Quarterly EPS: reported vs estimated, surprise percentage",
            category: "fundamentals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
            ],
        },
        {
            method: "GET",
            path: "/listing-status",
            summary: "List all active or delisted US tickers",
            category: "fundamentals",
            queryParams: [
                { name: "state", type: "string", required: false, description: "active or delisted", default: "active" },
                { name: "date", type: "string", required: false, description: "Date for historical listing status (YYYY-MM-DD)" },
            ],
        },
        {
            method: "GET",
            path: "/earnings-calendar",
            summary: "Upcoming earnings dates for all or specific companies",
            category: "fundamentals",
            queryParams: [
                { name: "symbol", type: "string", required: false, description: "Stock ticker (optional, all if omitted)" },
                { name: "horizon", type: "string", required: false, description: "3month, 6month, or 12month", default: "3month" },
            ],
        },
        {
            method: "GET",
            path: "/ipo-calendar",
            summary: "Upcoming IPO dates",
            category: "fundamentals",
        },
        // --- Economic Indicators ---
        {
            method: "GET",
            path: "/real-gdp",
            summary: "US Real GDP (quarterly or annual)",
            category: "economic",
            queryParams: [
                { name: "interval", type: "string", required: false, description: "quarterly or annual", default: "annual" },
            ],
        },
        {
            method: "GET",
            path: "/gdp-per-capita",
            summary: "US Real GDP per capita (annual)",
            category: "economic",
        },
        {
            method: "GET",
            path: "/treasury-yield",
            summary: "US Treasury yield by maturity (3month, 2year, 5year, 7year, 10year, 30year)",
            category: "economic",
            queryParams: [
                { name: "interval", type: "string", required: false, description: "daily, weekly, or monthly", default: "monthly" },
                { name: "maturity", type: "string", required: false, description: "3month, 2year, 5year, 7year, 10year, 30year", default: "10year" },
            ],
        },
        {
            method: "GET",
            path: "/federal-funds-rate",
            summary: "Federal Funds Effective Rate (daily, weekly, or monthly)",
            category: "economic",
            queryParams: [
                { name: "interval", type: "string", required: false, description: "daily, weekly, or monthly", default: "monthly" },
            ],
        },
        {
            method: "GET",
            path: "/cpi",
            summary: "Consumer Price Index (monthly or semiannual)",
            category: "economic",
            queryParams: [
                { name: "interval", type: "string", required: false, description: "monthly or semiannual", default: "monthly" },
            ],
        },
        {
            method: "GET",
            path: "/inflation",
            summary: "Annual inflation rate",
            category: "economic",
        },
        {
            method: "GET",
            path: "/retail-sales",
            summary: "Monthly US retail sales",
            category: "economic",
        },
        {
            method: "GET",
            path: "/durables",
            summary: "Monthly durable goods orders",
            category: "economic",
        },
        {
            method: "GET",
            path: "/unemployment",
            summary: "Monthly US unemployment rate",
            category: "economic",
        },
        {
            method: "GET",
            path: "/nonfarm-payroll",
            summary: "Monthly total nonfarm payroll employment",
            category: "economic",
        },
        // --- Technical Indicators ---
        {
            method: "GET",
            path: "/sma",
            summary: "Simple Moving Average",
            category: "technicals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
                { name: "interval", type: "string", required: true, description: "1min, 5min, 15min, 30min, 60min, daily, weekly, monthly" },
                { name: "time_period", type: "number", required: true, description: "Number of data points (e.g. 50, 200)" },
                { name: "series_type", type: "string", required: true, description: "close, open, high, low" },
            ],
        },
        {
            method: "GET",
            path: "/ema",
            summary: "Exponential Moving Average",
            category: "technicals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
                { name: "interval", type: "string", required: true, description: "Time interval" },
                { name: "time_period", type: "number", required: true, description: "Number of data points" },
                { name: "series_type", type: "string", required: true, description: "close, open, high, low" },
            ],
        },
        {
            method: "GET",
            path: "/rsi",
            summary: "Relative Strength Index",
            category: "technicals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
                { name: "interval", type: "string", required: true, description: "Time interval" },
                { name: "time_period", type: "number", required: true, description: "Number of data points (e.g. 14)" },
                { name: "series_type", type: "string", required: true, description: "close, open, high, low" },
            ],
        },
        {
            method: "GET",
            path: "/macd",
            summary: "Moving Average Convergence/Divergence",
            category: "technicals",
            queryParams: [
                { name: "symbol", type: "string", required: true, description: "Stock ticker" },
                { name: "interval", type: "string", required: true, description: "Time interval" },
                { name: "series_type", type: "string", required: true, description: "close, open, high, low" },
            ],
        },
        // --- Search ---
        {
            method: "GET",
            path: "/search",
            summary: "Search tickers by keyword or company name",
            category: "search",
            queryParams: [
                { name: "keywords", type: "string", required: true, description: "Search keywords (e.g. 'microsoft', 'AAPL')" },
            ],
        },
        // --- Commodities ---
        {
            method: "GET",
            path: "/wti",
            summary: "WTI crude oil price (daily, weekly, monthly)",
            category: "commodities",
            queryParams: [
                { name: "interval", type: "string", required: false, description: "daily, weekly, or monthly", default: "monthly" },
            ],
        },
        {
            method: "GET",
            path: "/brent",
            summary: "Brent crude oil price",
            category: "commodities",
            queryParams: [
                { name: "interval", type: "string", required: false, description: "daily, weekly, or monthly", default: "monthly" },
            ],
        },
    ],
};
