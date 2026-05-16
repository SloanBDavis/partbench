# MCP Stdio Server

This package is the minimal real stdio transport around `@web-cad/mcp-adapter`.
It does not define CAD tools itself. It reads newline-delimited JSON-RPC messages
from stdin, passes each decoded message into `CadMcpServer.handleJsonRpc`, and
writes one JSON-RPC response line to stdout.

Only these existing tools are exposed:

- `cad.project_summary`
- `cad.project_features`
- `cad.object_measurements`
- `cad.project_extents`
- `cad.transaction_history`
- `cad.batch`

The transport does not depend on React, the renderer, OCCT, OPFS, STEP
import/export, WebGPU, natural-language parsing, or the web app startup path.

## Run Locally

Start the stdio server:

```sh
pnpm --filter @web-cad/mcp-stdio-server start
```

The start script uses Node's `--experimental-transform-types` flag so this
workspace can run TypeScript source packages without adding a runtime loader
dependency. The compiled `build` output is still checked by CI, but the local
stdio process should be started through the package script above.

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

Commit batches require `"allowCommit": true` at the tool-argument level. Dry-run
batches do not require that flag. This permission check happens in the adapter
stack and is only an accidental-commit guard; it is not authentication or hosted
authorization.

The server keeps an in-memory `cad-core` document for the lifetime of the
process through the existing adapter stack. Restarting the process resets that
document.

`cad.project_summary` returns document units and object names when present.
`cad.project_features` returns read-only primitive feature summaries derived
from the current scene objects and transaction history.
`cad.object_measurements` and `cad.project_extents` return read-only derived
bounds and approximate volumes from the authoritative document. Unit changes go
through CADOps: `metadataOnly` relabels numeric values, while
`preservePhysicalSize` scales current dimensions and transform translations in
`cad-core`.
`cad.transaction_history` returns read-only summaries of the in-memory
transaction and redo history, including actor and audit metadata when present.
