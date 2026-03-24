import { restFetch } from "@bio-mcp/shared/http/rest-fetch";
import type { RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const AV_BASE = "https://www.alphavantage.co";

export interface AvFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    apiKey?: string;
}

/**
 * Fetch from the Alpha Vantage API.
 * All requests go to /query with function= and apikey= query params.
 */
export async function avFetch(
    functionName: string,
    params?: Record<string, unknown>,
    opts?: AvFetchOptions,
): Promise<Response> {
    const apiKey = opts?.apiKey || "demo";
    const queryParams: Record<string, unknown> = {
        function: functionName,
        apikey: apiKey,
        ...params,
    };

    return restFetch(AV_BASE, "/query", queryParams, {
        ...opts,
        headers: {
            Accept: "application/json",
            ...(opts?.headers ?? {}),
        },
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 2,
        timeout: opts?.timeout ?? 30_000,
        userAgent: "alphavantage-mcp-server/1.0 (bio-mcp)",
    });
}
