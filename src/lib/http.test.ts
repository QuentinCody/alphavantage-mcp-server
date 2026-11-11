import { afterEach, expect, it, vi } from "vitest";
import { avFetch } from "./http";
import { createAvApiFetch } from "./api-adapter";
const apiKey = "fixture-key-not-real";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("retains exact UTF-8/BOM source bytes and literal query values", async () => {
  const raw = '\uFEFF{"feed":[],"text":"α😀"}\r\n';
  const bytes = new TextEncoder().encode(raw);
  const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream({start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close();
  }})));
  vi.stubGlobal("fetch", fetcher);
  const result = await avFetch("NEWS_SENTIMENT", {tickers:"A+B,FOREX:USD"}, {apiKey});
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  expect(result.provenance).toMatchObject({ raw_json: raw, response_bytes: bytes.length, redacted: false,
    response_sha256: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,"0")).join("") });
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("tickers")).toBe("A+B,FOREX:USD");
  expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:"manual"});
  expect(JSON.stringify(result)).not.toContain(apiKey);
});

it.each([302,401,429,503,206])("preserves bounded native HTTP %i evidence without replay", async status => {
  const text = "native failure α".repeat(3000);
  const fetcher=vi.fn().mockResolvedValue(new Response(text,{status,headers:{"retry-after":"60"}}));
  vi.stubGlobal("fetch",fetcher);
  await expect(avFetch("NEWS_SENTIMENT",{}, {apiKey})).rejects.toMatchObject({status,data:{text,retry_after:"60",provenance:{raw_json:text,response_sha256:expect.any(String)}}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("rejects byte fragments even with successful status",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("{}",{headers:{"content-range":"bytes 0-1/100"}})));
  await expect(avFetch("NEWS_SENTIMENT",{}, {apiKey})).rejects.toMatchObject({status:502,data:{text:"{}"}});
});

it.each([true,false])("bounds bytes with or without declared length (%s)",async declared=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("α".repeat(10),{headers:declared?{"content-length":"20"}:{}})));
  await expect(avFetch("NEWS_SENTIMENT",{}, {apiKey,maxBytes:19})).rejects.toThrow("byte limit");
});

it("rejects malformed UTF-8",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(new Uint8Array([0xc0,0xaf]))));
  await expect(avFetch("NEWS_SENTIMENT",{}, {apiKey})).rejects.toThrow("UTF-8");
});

it.each(["headers","body"])("enforces the deadline during %s even when abort/cancel do not settle",async phase=>{
  vi.useFakeTimers(); const cancel=vi.fn(()=>new Promise<void>(()=>{}));
  const fetcher=vi.fn().mockImplementation(()=>phase==="headers"?new Promise(()=>{}):Promise.resolve(new Response(new ReadableStream({cancel}))));
  vi.stubGlobal("fetch",fetcher);
  const promise=expect(avFetch("NEWS_SENTIMENT",{}, {apiKey,timeoutMs:50})).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(51); await promise;
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  if(phase==="body")expect(cancel).toHaveBeenCalled();
});

it("disposes a response arriving after the header deadline",async()=>{
  vi.useFakeTimers();const cancel=vi.fn();let finish:(response:Response)=>void=()=>{};
  vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve})));
  const pending=expect(avFetch("NEWS_SENTIMENT",{}, {apiKey,timeoutMs:50})).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(51);await pending;
  finish(new Response(new ReadableStream({cancel})));await Promise.resolve();await Promise.resolve();
  expect(cancel).toHaveBeenCalled();
});

it("retains large provider notices with redaction and original-byte hash scope",async()=>{
  const secret='fixture+key/"value';
  const message="Subscription restriction α".repeat(2000)+secret+encodeURIComponent(secret);
  const raw=JSON.stringify({Information:message});
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(raw)));
  const error=await avFetch("NEWS_SENTIMENT",{}, {apiKey:secret}).catch(error=>error);
  expect(error).toMatchObject({status:502,data:{code:"PROVIDER_NOTICE",data_access_verified:false,provenance:{redacted:true,response_bytes:new TextEncoder().encode(raw).length}}});
  expect(error.data.message.length).toBeGreaterThan(40000);
  expect(error.data.message).toContain("[REDACTED]");expect(JSON.stringify(error.data)).not.toContain(encodeURIComponent(secret));
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
  expect(error.data.provenance.response_sha256).toBe(Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join(""));
});

it("preserves colliding native metadata in source JSON and unknown coverage",async()=>{
  const raw='{"feed":[],"_mcp":{"native":true},"unknown":9007199254740993}';
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(raw)));
  const result=await createAvApiFetch(apiKey)({method:"GET",path:"/news-sentiment",params:{limit:50}});
  expect(result).toMatchObject({upstreamTotal:null,completeness:{complete:false},data:{_mcp:{provenance:{raw_json:raw},completeness:{complete:false}}}});
});

it.each(["null","[]","1","<html>verification page</html>"])("rejects non-object/JSON success %s",async raw=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(raw)));
  await expect(avFetch("NEWS_SENTIMENT",{}, {apiKey})).rejects.toMatchObject({status:502,data:{text:raw}});
});
