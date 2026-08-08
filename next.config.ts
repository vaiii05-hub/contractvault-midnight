import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // The indexer public data provider's `import * as ws from
      // 'isomorphic-ws'` breaks under the browser build, which only
      // default-exports WebSocket. Route it to a stub exposing the same
      // names (see src/lib/isomorphic-ws.ts).
      "isomorphic-ws": "./src/lib/isomorphic-ws.ts",
    },
  },
};

export default nextConfig;
