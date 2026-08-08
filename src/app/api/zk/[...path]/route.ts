// src/app/api/zk/[...path]/route.ts
// Serves the compiled ZK artifacts (contract/build/{keys,zkir}) to the
// browser's FetchZkConfigProvider. The wallet's proof server needs these over
// HTTP, so we expose exactly the layout FetchZkConfigProvider expects:
//
//   /api/zk/keys/<circuit>.prover
//   /api/zk/keys/<circuit>.verifier
//   /api/zk/zkir/<circuit>.bzkir
//
// Serving from disk (instead of copying into /public) keeps the files in sync
// with the latest compile output in contract/build.
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const ARTIFACT_ROOT = path.join(process.cwd(), "contract", "build");

const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9-]*\.(prover|verifier|bzkir)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const segments = (await params).path ?? [];
  const [kind, fileName] = segments;

  if (segments.length !== 2 || (kind !== "keys" && kind !== "zkir")) {
    return new Response("Not found", { status: 404 });
  }
  if (!SAFE_FILE.test(fileName)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await fs.readFile(path.join(ARTIFACT_ROOT, kind, fileName));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
