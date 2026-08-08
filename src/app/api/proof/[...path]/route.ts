// src/app/api/proof/[...path]/route.ts
// Proxies proof-server requests from the browser to our local proof server
// (midnightntwrk/proof-server:8.0.3 on 127.0.0.1:6300 — the same one
// scripts/deploy.mts uses to deploy/prove).
//
// The browser's httpClientProvingProvider POSTs raw octet-stream payloads to
//   /api/proof/prove  and  /api/proof/check
// We forward them verbatim to the local proof server. Routing through a
// same-origin path avoids CORS entirely (the /prove POST uses a
// non-safelisted Content-Type, so a direct cross-origin fetch to 127.0.0.1
// would require the proof server to answer preflights, which it doesn't).
//
// Override the upstream with PROOF_SERVER_URL if your proof server runs
// elsewhere (mirrors scripts/deploy.mts).
export const runtime = "nodejs";

const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const segments = (await params).path ?? [];
  const endpoint = segments[0];
  if (segments.length !== 1 || (endpoint !== "prove" && endpoint !== "check")) {
    return new Response("Not found", { status: 404 });
  }

  // Buffering the body keeps the upstream fetch simple (no duplex needed).
  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return new Response("Failed to read request body", { status: 400 });
  }

  const upstream = `${PROOF_SERVER_URL.replace(/\/$/, "")}/${endpoint}`;
  try {
    const upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(body),
      // Local proof server should be fast; fail loudly rather than hang.
      signal: AbortSignal.timeout(120_000),
    });
    if (!upstreamRes.ok) {
      return new Response(
        `Local proof server (${upstream}) responded ${upstreamRes.status} ${upstreamRes.statusText}`,
        { status: upstreamRes.status },
      );
    }
    const proofBytes = new Uint8Array(await upstreamRes.arrayBuffer());
    return new Response(proofBytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `Local proof server unreachable at ${upstream}: ${message}. ` +
        `Make sure midnightntwrk/proof-server:8.0.3 is running on port 6300 ` +
        `(docker run -d --name proof-server -p 6300:6300 midnightntwrk/proof-server:8.0.3).`,
      { status: 502 },
    );
  }
}

// Some HTTP stacks issue a GET to probe availability; answer it quickly.
export async function GET(): Promise<Response> {
  return new Response("proof proxy ready", { status: 200 });
}
