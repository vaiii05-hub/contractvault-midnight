// src/lib/isomorphic-ws.ts
// Browser-compatible stand-in for `isomorphic-ws`. The indexer public data
// provider imports it as `import * as ws from 'isomorphic-ws'` and reads
// `ws.WebSocket`, but the package's browser build only default-exports the
// global WebSocket (which makes Turbopack reject the named export). We alias
// the module to this stub instead, which exposes the platform WebSocket (the
// browser's, or Node's global since v22) under the same names.
const WebSocketImpl = globalThis.WebSocket;

export { WebSocketImpl as WebSocket };
export default WebSocketImpl;
