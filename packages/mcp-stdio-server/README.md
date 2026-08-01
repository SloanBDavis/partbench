# MCP Stdio Server

This package is the minimal real stdio transport around `@web-cad/mcp-adapter`.
It does not define CAD tools itself. It reads newline-delimited JSON-RPC messages
from stdin, awaits each decoded message through `CadMcpServer.handleJsonRpcAsync`,
and writes responses to stdout with their original request IDs. A proposal-
waiting call does not block later queries, dry-runs, or `tools/list`.

The authoritative tool inventory is the result of MCP `tools/list`; the stdio
transport exposes exactly the registry owned by `@web-cad/mcp-adapter`.

The Node package does not define React, renderer, OCCT, OPFS, STEP, WebGPU, or
natural-language behavior. It serves the production app and relays only the
four typed adapter operations.

The production executable owns no CAD document. It binds an operating-system-
selected port on `127.0.0.1`, serves only `apps/web/dist`, opens one tokenized
URL, and relays MCP adapter calls to the `CadEngine` already used by that browser
tab. `createMcpStdioSession()` retains its in-memory default for compatible
tests and programmatic callers.

## Run Locally

Start the stdio server:

```sh
pnpm --filter @web-cad/mcp-stdio-server start
```

The start script builds the production web app and a bundled JavaScript stdio
executable, then opens the authenticated loopback URL. The bundle uses a
dev-only build tool; V20 adds no production dependency or runtime TypeScript
loader.

Send one JSON-RPC request per line. For example:

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | pnpm --filter @web-cad/mcp-stdio-server start
```

Call `cad.batch`:

```json
{
  "jsonrpc": "2.0",
  "id": "create-box",
  "method": "tools/call",
  "params": {
    "name": "cad.batch",
    "arguments": {
      "allowCommit": true,
      "batch": {
        "version": "cadops.v1",
        "mode": "commit",
        "ops": [
          {
            "op": "scene.createBox",
            "id": "stdio_box",
            "name": "Stdio box",
            "dimensions": { "width": 2, "height": 3, "depth": 4 }
          },
          {
            "op": "document.updateUnits",
            "units": "in"
          }
        ]
      }
    }
  }
}
```

In the connected executable, `allowCommit` remains accepted for compatibility
but does not control authority. The Project → Agent page owns exactly two
session-only modes: Manual approval by default and explicitly confirmed Approve
everything. Caller-requested dry-runs remain dry-runs. The in-memory adapter
retains its existing `allowCommit` behavior.

`cad.batch` responses include the same structured agent review block as the MCP
adapter package: requested mode, effective intent, operation labels,
entity-change counts, audit summary, commit-gate state, hints, and blockers.
Manual rejection, busy, stale proposal, token, connection, and disconnect
outcomes use the bounded V20 session diagnostics and do not mutate the browser
document.

V19 offset follows the same JSON-RPC path: request
`cad.sketch_curve_edit_readiness` with a typed source entity or ordered oriented
chain, then submit the returned operation unchanged through `cad.batch`.
Offsets create independent ordinary geometry and are not associative. Pixels,
screenshots, opaque tokens, scripts, and filesystem paths are not accepted as
source substitutes. Caller-supplied ordered IDs for `sketch.addSlot` and
`sketch.addRoundedRectangle` also pass through `cad.batch` without a
transport-specific mutation.

Tool schemas and semantics are owned by `@web-cad/mcp-adapter`; CADOps query and
mutation semantics are owned by the agent adapter and `cad-core`. This package
only preserves JSON-RPC request IDs, stdio framing, fixed-bundle serving, and
authenticated request/response relay state.

V21 readiness metadata traverses that same authenticated relay, but exact
artifact and STEP bytes stay in the browser. Planning is read-only, creates no
approval proposal, and leaves V20's two session-only approval modes unchanged.
