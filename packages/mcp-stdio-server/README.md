# MCP Stdio Server

This package is the minimal real stdio transport around `@web-cad/mcp-adapter`.
It does not define CAD tools itself. It reads newline-delimited JSON-RPC messages
from stdin, passes each decoded message into `CadMcpServer.handleJsonRpc`, and
writes one JSON-RPC response line to stdout.

Only these existing tools are exposed:

- `cad.project_summary`
- `cad.project_features`
- `cad.project_structure`
- `cad.project_health`
- `cad.project_sketches`
- `cad.parameter_list`
- `cad.parameter_get`
- `cad.object_measurements`
- `cad.body_measurements`
- `cad.body_topology`
- `cad.project_extents`
- `cad.sketch_get`
- `cad.sketch_evaluation`
- `cad.sketch_dimensions`
- `cad.sketch_dimension_get`
- `cad.body_generated_references`
- `cad.resolve_generated_reference`
- `cad.generated_reference_measurements`
- `cad.named_references`
- `cad.resolve_named_reference`
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

`cad.batch` responses include the same structured agent review block as the MCP
adapter package: requested mode, effective intent, operation labels,
entity-change counts, audit summary, commit-gate state, hints, and blockers.
Refused commits include a `COMMIT_NOT_ALLOWED` review blocker and do not mutate
the in-memory document.

The server keeps an in-memory `cad-core` document for the lifetime of the
process through the existing adapter stack. Restarting the process resets that
document.

`cad.project_summary` returns document units and object names when present.
`cad.project_features` returns read-only primitive-derived feature summaries
from current scene objects plus authored sketch-extrude feature summaries.
`cad.project_structure` returns the default part, primitive-derived
features/bodies, authored sketch-extrude features/bodies, and source mappings
for the current model.
`cad.project_health` returns read-only dependency health for authored extrudes,
attached sketches, sketch dimensions, sketch constraints, and named references.
`cad.parameter_list` and `cad.parameter_get` return source-of-truth document
parameters.
`cad.project_sketches` and `cad.sketch_get` return source-of-truth sketch
containers and entities from the authoritative document model.
`cad.sketch_dimensions`, `cad.sketch_dimension_get`, and
`cad.sketch_evaluation` return current driving dimensions and derived
solver/evaluator status for one sketch.
`cad.named_references` and `cad.resolve_named_reference` inspect
source-of-truth user/agent names assigned to generated references.
`cad.object_measurements`, `cad.body_measurements`, `cad.body_topology`,
`cad.project_extents`, and `cad.generated_reference_measurements` return
read-only source-derived measurements or derived exact/topology status from the
authoritative document. Generated-reference measurements use semantic
body/face/edge/vertex references for authored sketch-extrude bodies, not raw
kernel, mesh, or renderer indexes. Unit changes go through CADOps:
`metadataOnly` relabels numeric values, while
`preservePhysicalSize` scales current dimensions and transform translations in
`cad-core`.
`cad.transaction_history` returns read-only summaries of the in-memory
transaction and redo history, including actor and audit metadata when present.
