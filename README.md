# Alpha Vantage MCP server

Cloudflare Worker exposing Alpha Vantage through Code Mode, with `av_*` and
`mcp_av_*` tool aliases. Configure `ALPHAVANTAGE_API_KEY` in Worker secrets or local
`.dev.vars`; there is no automatic demo-key fallback. Access depends on the key's
entitlements and quota. Quote freshness must be read from provider timestamps.

## Market intelligence additions

The catalog now exposes news sentiment, earnings-call transcripts, realtime and
historical options, insider transactions, institutional holdings, and ETF profiles.
These map to the native functions documented in the
[provider API reference](https://www.alphavantage.co/documentation/). The
[official MCP implementation](https://github.com/alphavantage/alpha_vantage_mcp)
provides a coverage comparator.

Named virtual routes validate documented parameters. `/raw` requires an explicit
function and accepts bounded scalar parameters; credentials and mapped functions
cannot be overridden. Only JSON responses are supported. Legacy CSV-only calendar
and listing functions still need a separate CSV reader.

The new routes preserve the native payload and add `_mcp` request provenance,
retrieval time, original-byte SHA-256/count and retained JSON text (including BOM
and line endings). That text also preserves unknown or colliding native `_mcp`
fields and original numeric tokens. Parsed JSON numbers retain JavaScript precision
limits; numeric strings remain strings. Article
publication time, fiscal quarter, transaction date, holdings reporting period and
retrieval time remain separate. Results do not establish historical public
availability, complete coverage or a verified response schema. News has a bounded
limit and no inferred cursor; narrow publication windows when the cap is reached.

HTTP-200 provider notices (`Information`, `Note`, `Error Message`) and responses
explicitly labeled artificial or illustrative surface as errors. The public options
demo inspected during this review used artificial prices; it is not a market-data
validation fixture. Bounded native text, including illustrative rows, is retained
only as explicit error evidence. Echoed credentials are redacted; the redaction
flag distinguishes transformed text from the original-byte hash/count.

Code Mode recipes cover bounded life-sciences news, separate transcript/ownership
timelines, and an explicitly dated historical option chain. The ownership recipe
retains all three complete source handles when responses stage, stopping on
provider/staging errors. Complete MCP envelopes, including large SQL and error
responses, stage above 30 KiB with transport headroom and verifiable citations.
The transport bounds complete reads at 4 MiB/50 seconds, makes one attempt, and
rejects redirects, partial responses, malformed UTF-8 and invalid JSON.

Staged intelligence collections expose `av_records`, ordered by `mcp_source_index`.
`mcp_source_collection` names the observed native array; `$` means one full source
record for an unknown envelope, not a verified institutional holdings schema.
`mcp_native_json` preserves every nested value, duplicate and reserved-name field.
Direct scalar columns are a convenience projection; use native JSON for complete
types and case-sensitive field identity. For example:

```sql
SELECT mcp_source_index, mcp_native_json
FROM av_records
ORDER BY mcp_source_index
LIMIT 10 OFFSET 0
```

Use smaller batches or `substr(mcp_native_json, ...)` for large transcript turns
or source records. `payloads` retains the complete source/envelope independently;
large stored text can use `content_chunks`. Restaged SQL exposes ordered
`query_rows(row_index, native_json)`. Inspect schema before querying. Empty arrays
do not fabricate rows, and unknown coverage remains explicit after composition.

## Validation status

Local synthetic fixtures cover native payload preservation, parameter validation,
key isolation, full-body deadlines, native refusals, artificial demo data, composed
source handles, all aliases and actual MCP HTTP/Node SQLite recovery. Local
JavaScript substitutes for isolate execution. Authenticated provider schemas,
entitlements, real data and edited Workerd acceptance remain pending.
See the [implementation tracker](../../../../docs/plans/2026-09-26-upstream-api-implementation.md)
for test results and environment limitations. Nothing has been deployed by this review.

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from Alpha Vantage and stays under the terms of that source: Non-sublicensable, non-transferable license.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
