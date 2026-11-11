import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { avCatalog } from "../spec/catalog";
import { createAvApiFetch } from "../lib/api-adapter";
import { avResponse, AV_SOURCE } from "../lib/tool-result";

interface CodeModeEnv {
  AV_DATA_DO: DurableObjectNamespace;
  CODE_MODE_LOADER: WorkerLoader;
  ALPHAVANTAGE_API_KEY?: string;
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
  const apiFetch = createAvApiFetch(env.ALPHAVANTAGE_API_KEY);
  const registrar = { tool: (...args: unknown[]) => {
    const [name, ...rest] = args;
    const register = server.tool.bind(server) as (...values: unknown[]) => void;
    const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof avResponse>;
    for (const alias of [String(name), `mcp_${String(name)}`]) register(alias, ...rest,
      (input: unknown, extra: unknown) => avResponse(() => handler(input, extra), env, alias, extra, input));
  } };

  const searchTool = createSearchTool({
    prefix: "av",
    catalog: avCatalog,
  });
  searchTool.register(registrar);

  const executeTool = createExecuteTool({
    prefix: "av",
    // Verifiable provenance: av_execute results carry a _meta.citation.
    source: AV_SOURCE,
    catalog: avCatalog,
    apiFetch,
    preserveApiErrors: true,
    maxInlineBytes: 30 * 1024,
    stagingThreshold: 30 * 1024,
    timeout: 90_000,
    doNamespace: env.AV_DATA_DO,
    loader: env.CODE_MODE_LOADER,
  });
  executeTool.register(registrar);
}
