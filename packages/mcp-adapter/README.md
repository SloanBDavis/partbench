# MCP Adapter

This package is the MCP tool wrapper over the existing CADOps agent adapter. It
keeps `@web-cad/agent-adapter` as the internal API boundary and does not define
CAD operations itself.

It exposes these MCP-style tools:

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

Commit uses the same `cad.batch` tool with `"mode": "commit"`, but the MCP
wrapper requires an explicit top-level `"allowCommit": true` argument before it
will forward a commit to the agent adapter. Dry-runs do not require this flag.
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

MCP also passes generic audit metadata through the agent adapter: source `mcp`,
tool name `cad.batch`, request ID, intent, and operation count. The committed
transaction history exposes this audit metadata. Missing `allowCommit: true`
returns a structured `COMMIT_NOT_ALLOWED` adapter error and does not mutate the
document. Batch responses also include an agent review block so a caller can
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
document, not renderer meshes. Current measurements support boxes, cylinders,
spheres, cones, and tori and include local bounds, world bounds, and approximate
volume.
