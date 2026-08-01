# MCP Adapter

This package is the MCP tool wrapper over the existing CADOps agent adapter. It
keeps `@web-cad/agent-adapter` as the internal API boundary and does not define
CAD operations itself.

The authoritative tool inventory is the result of MCP `tools/list`; do not
duplicate that generated registry in documentation. The current tools cover
project/feature/sketch inspection, parameters, measurements, topology and
repair readiness, reference and selection candidates, V19 curve/region
queries, transaction history, exact export/package readiness, and `cad.batch`.

It does not depend on React, the renderer, OCCT, OPFS, STEP import/export,
WebGPU, natural-language parsing, or the web app startup path.

## Boundary

The MCP wrapper accepts MCP-style tool calls, translates them into existing agent
adapter calls, and returns structured adapter responses.

```text
MCP client
  -> structured cad.* tools
    -> @web-cad/mcp-adapter
      -> @web-cad/agent-adapter
        -> CADOps
          -> cad-core authoritative document
```

The wrapper does not move document authority into MCP. `cad-core` remains the
only package that owns document mutation.

V20 adds one narrow awaitable execution port for batch, query, V8-surface, and
current-selection calls. The connected stdio launcher supplies its browser
relay as that port; existing in-memory callers remain the default. Tool schemas,
validation, and response shaping are shared in both paths.

V21 extends existing project health/readiness results with the exact export plan
and bounded connected-browser evidence. No STEP/download tool is added: MCP
receives no artifact bytes, handles, paths, renderer IDs, approval proposal, or
new permission surface.

## Local Client Shape

This package provides an in-process JSON-RPC handler for the MCP methods
`tools/list` and `tools/call`. The separate `@web-cad/mcp-stdio-server` package
passes stdio JSON-RPC messages into this handler.

List tools:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

Call `cad.project_summary`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "cad.project_summary",
    "arguments": {}
  }
}
```

Call `cad.project_features`:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "cad.project_features",
    "arguments": {}
  }
}
```

Call `cad.project_structure`:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "cad.project_structure",
    "arguments": {}
  }
}
```

Call `cad.project_sketches`:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "cad.project_sketches",
    "arguments": {}
  }
}
```

Call `cad.object_measurements`:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "cad.object_measurements",
    "arguments": { "id": "preview_box" }
  }
}
```

Call `cad.project_extents`:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "cad.project_extents",
    "arguments": {}
  }
}
```

Call `cad.sketch_get`:

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "cad.sketch_get",
    "arguments": { "id": "sketch_1" }
  }
}
```

Call `cad.transaction_history`:

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "cad.transaction_history",
    "arguments": {}
  }
}
```

For V19 offset, call `cad.sketch_curve_edit_readiness` with a typed source
entity or ordered oriented chain, then submit its exact `preparedOperation` as
the only operation in `cad.batch`. Offset is non-associative: it creates
independent ordinary sketch entities and stores no persistent source link or
distance constraint. The MCP boundary accepts model-space typed refs, not
pixels, screenshots, opaque candidate tokens, scripts, raw selectors, or
filesystem paths.

V19 `sketch.addSlot` and `sketch.addRoundedRectangle` commands go directly
through `cad.batch` and may include the exact ordered caller-supplied
`entityIds` and `constraintIds`. The responses preserve ordinary semantic
diffs, actor/audit/request metadata, and commit transaction identity from the
shared adapter/core path. Read solver health and diagnostics through the
separate `cad.sketch_solver_status` tool.

Call `cad.v8_project_surface` to inspect the V8 package/export surface in one
compact response:

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "cad.v8_project_surface",
    "arguments": {
      "exactExport": {
        "format": "step",
        "bodyIds": ["body_1"]
      }
    }
  }
}
```

The V8 surface is read-only. It reports `.wcad` package readiness, optional
rebuildable cache status, exact STEP readiness/export availability, unsupported
body diagnostics, and file-writing boundaries through the agent adapter. It does
not accept local write targets or return artifact bytes.

Call `cad.batch` in dry-run mode:

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "cad.batch",
    "arguments": {
      "batch": {
        "version": "cadops.v1",
        "mode": "dryRun",
        "ops": [
          {
            "op": "scene.createBox",
            "id": "preview_box",
            "name": "Preview box",
            "dimensions": { "width": 10, "height": 20, "depth": 30 }
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

Commit uses the same `cad.batch` tool with `"mode": "commit"`. The in-memory
adapter requires an explicit top-level `"allowCommit": true`; the connected V20
executable accepts the field for compatibility while the browser's session-only
approval mode controls commit authority. Dry-runs do not require this flag.
Callers can provide optional actor metadata either inside the batch or as a
top-level tool argument:

```json
{
  "name": "cad.batch",
  "arguments": {
    "allowCommit": true,
    "actor": {
      "type": "agent",
      "id": "local-agent",
      "name": "Local Agent"
    },
    "batch": {
      "version": "cadops.v1",
      "mode": "commit",
      "ops": [
        {
          "op": "scene.createBox",
          "id": "agent_box",
          "dimensions": { "width": 10, "height": 20, "depth": 30 }
        }
      ]
    }
  }
}
```

When no actor is provided, the MCP wrapper marks committed transactions as an
agent-originated MCP commit. Actor metadata is audit context only; it is not an
authorization or permission system.

### V17 explicit refs

V17 profile/path candidates are query results, not geometry for MCP to resolve.
After choosing a candidate, pass its ordered ref unchanged through `cad.batch`.
This update example uses explicit IDs and a path copied from a
`sketch.pathCandidates` response:

```json
{
  "name": "cad.batch",
  "arguments": {
    "batch": {
      "version": "cadops.v1",
      "mode": "dryRun",
      "ops": [
        {
          "op": "feature.updateSweep",
          "id": "feature_curved_sweep",
          "profile": {
            "kind": "entity",
            "sketchId": "sketch_profile",
            "entityId": "circle_profile"
          },
          "path": {
            "kind": "chain",
            "sketchId": "sketch_path",
            "segments": [
              { "entityId": "line_entry", "orientation": "forward" },
              { "entityId": "arc_turn", "orientation": "forward" }
            ]
          }
        }
      ]
    }
  }
}
```

Run the same operation in commit mode only after the dry-run is accepted. Use
`allowCommit: true` for the in-memory adapter; the connected V20 executable uses
the browser's approval mode instead. MCP does not choose the first, largest, or
nearest candidate and does not reorder the returned segments.

MCP also passes generic audit metadata through the agent adapter: source `mcp`,
tool name `cad.batch`, request ID, intent, and operation count. The committed
transaction history exposes this audit metadata. In-memory calls missing
`allowCommit: true` return a structured `COMMIT_NOT_ALLOWED` adapter error and
do not mutate the document. Batch responses also include an agent review block so a caller can
inspect requested mode, effective intent, operation labels, entity-change
counts, audit summary, commit-gate state, hints, and blockers before deciding
whether to re-run a dry-run as an allowed commit.

## Response Shape

Tool results include the normal MCP-style `content` text plus
`structuredContent`. For successful CADOps calls, `structuredContent` is the
agent adapter response:

```json
{
  "toolName": "cad.batch",
  "isError": false,
  "structuredContent": {
    "ok": true,
    "requestId": "mcp_jsonrpc_3",
    "adapterVersion": "web-cad.agent-adapter.v1",
    "cadOpsVersion": "cadops.v1",
    "mode": "dryRun",
    "createdIds": ["preview_box"],
    "modifiedIds": [],
    "deletedIds": [],
    "warnings": [],
    "audit": {
      "source": "mcp",
      "requestId": "mcp_jsonrpc_3",
      "toolName": "cad.batch",
      "intent": "dryRun",
      "operationCount": 2
    },
    "review": {
      "requestedMode": "dryRun",
      "effectiveIntent": "dryRun",
      "operationCount": 2,
      "entityChanges": {
        "objects": { "created": 1, "modified": 0, "deleted": 0 }
      },
      "operations": [
        {
          "index": 0,
          "op": "scene.createBox",
          "intent": "create",
          "label": "Create box preview_box",
          "objectId": "preview_box"
        },
        {
          "index": 1,
          "op": "document.updateUnits",
          "intent": "modify",
          "label": "Set document units to in"
        }
      ],
      "audit": {
        "source": "mcp",
        "requestId": "mcp_jsonrpc_3",
        "toolName": "cad.batch",
        "intent": "dryRun",
        "operationCount": 2
      },
      "commitGate": {
        "commitsRequireExplicitPermission": true,
        "dryRunsRequirePermission": false,
        "permissionProvided": false,
        "blocked": false
      },
      "hints": [],
      "blockers": []
    }
  },
  "content": [
    {
      "type": "text",
      "text": "{ ...same response as formatted JSON... }"
    }
  ]
}
```

Validation failures from CADOps are returned as structured CADOps errors.
Unknown tools or malformed wrapper arguments return tool-level errors with
`UNKNOWN_TOOL` or `INVALID_ARGUMENTS`.

Project summary responses include the document units and object display names
when present. Unit changes remain CADOps mutations: `metadataOnly` relabels
current numeric values, while `preservePhysicalSize` scales current dimensions
and transform translations in `cad-core`.

Measurement responses are read-only derived data from the authoritative
document, not renderer meshes. `cad.object_measurements` supports boxes,
cylinders, spheres, cones, and tori; body, generated-reference, topology, and
mass-property data use their existing dedicated tools.
