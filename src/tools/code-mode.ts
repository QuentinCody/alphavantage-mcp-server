import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { avCatalog } from "../spec/catalog";
import { createAvApiFetch, setAvApiKey } from "../lib/api-adapter";

interface CodeModeEnv {
    AV_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
    ALPHAVANTAGE_API_KEY?: string;
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
    if (env.ALPHAVANTAGE_API_KEY) {
        setAvApiKey(env.ALPHAVANTAGE_API_KEY);
    }

    const apiFetch = createAvApiFetch();

    const searchTool = createSearchTool({
        prefix: "av",
        catalog: avCatalog,
    });
    searchTool.register(server as unknown as { tool: (...args: unknown[]) => void });

    const executeTool = createExecuteTool({
        prefix: "av",
        catalog: avCatalog,
        apiFetch,
        doNamespace: env.AV_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
