# MCP Stdio Server

This package is the minimal real stdio transport around `@web-cad/mcp-adapter`.
It does not define CAD tools itself. It reads newline-delimited JSON-RPC messages
from stdin, awaits each decoded message through `CadMcpServer.handleJsonRpcAsync`,
and writes responses to stdout with their original request IDs. A proposal-
waiting call does not block later queries, dry-runs, or `tools/list`.

The authoritative tool inventory is the result of MCP `tools/list`; the stdio
transport exposes exactly the registry owned by `@web-cad/mcp-adapter`.

The Node package owns transport and workspace file access. Shared
`@web-cad/cad-runtime` owns headless exact evaluation and persistence; the
existing browser host remains available.

In browser mode the executable owns no CAD document. It binds an operating-system-
selected port on `127.0.0.1`, serves only `apps/web/dist`, opens one tokenized
URL, and relays MCP adapter calls to the `CadEngine` already used by that browser
tab. `createMcpStdioSession()` retains its in-memory default for compatible
tests and programmatic callers.

## Headless agent session

Build once with Node 22 and pnpm 10, then configure the MCP client to launch
the executable directly. No web build, browser, display server, or port is
needed for headless mode.

```sh
pnpm --filter @web-cad/mcp-stdio-server build
node packages/mcp-stdio-server/dist/stdio.js --headless --workspace /absolute/project/directory
```

`--workspace` defaults to the current directory and must name an existing
directory. File paths can be relative to it or absolute within it. Parent
traversal and symlinks outside the workspace are rejected. Output subdirectories
must already exist. Native input is limited to 256 MiB. Writes publish complete
files atomically; replacing an existing file requires `overwrite: true`.

The transport implements MCP initialization (protocol `2025-06-18`), ping,
notifications, tool discovery, and tool calls. Only JSON-RPC responses go to
stdout. For scripting, existing direct `tools/list` / `tools/call` requests
remain supported without a handshake. Use the built Node executable for MCP
configuration; build/package-manager progress must not enter protocol stdout.

Start with `cad.session_info`. It returns the execution mode, canonical
workspace, exact-runtime capabilities, current source identity, and a short
workflow. Use `cad.batch` with `allowCommit: true` for commits. Related creation
or revision operations can share a transaction using caller-supplied IDs.
Use `mode: "dryRun"` to validate without committing. Query
`cad.project_structure` for IDs and `cad.body_mass_properties` for exact geometry.
The headless host serializes batch, query, open, save, and export calls so
pipelined requests observe preceding changes.

File examples (the `params` object of a `tools/call` request):

```json
{"name":"cad.project_save","arguments":{"path":"part.wcad"}}
{"name":"cad.project_open","arguments":{"path":"part.wcad"}}
{"name":"cad.project_export_file","arguments":{"path":"part.step","format":"step"}}
```

STEP export optionally accepts `bodyIds`; native save and STEP export accept
`overwrite`. Success contains `structuredContent: { ok: true, result: ... }`
with the artifact path, format, byte length, and source/export metadata. Errors
contain `ok: false` and a code/message such as `FILE_EXISTS`,
`PATH_OUTSIDE_WORKSPACE`, or `PATH_NOT_FOUND`. Native open replaces the session
project only after validation; save first to retain the current project.
The `.wcad` output opens in the browser workbench without a format conversion.
Headless files are local artifacts; no browser download is requested.

## Browser session

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
preserves JSON-RPC request IDs and stdio framing. Its host adapters provide
either fixed-bundle serving and authenticated browser relay state, or the shared
exact session with confined local artifact reads and writes.

V21 readiness metadata traverses that same authenticated relay, but exact
artifact and STEP bytes stay in the browser. Planning is read-only, creates no
approval proposal, and leaves V20's two session-only approval modes unchanged.

V21.1 adds the fifth operation, `cad.project_request_exact_export`. It accepts
an all-body, ready-subset, or bounded explicit-body plan; uses the same Manual
approval or Approve everything session mode; asks the browser to create the
download; and returns bounded metadata with `downloadRequested`. The stdio
process and MCP caller receive no STEP bytes, path, filename, Blob, URL, handle,
or claim that the browser completed a download.
