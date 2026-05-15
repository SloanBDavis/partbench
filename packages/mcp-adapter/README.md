# MCP Adapter

This package is the MCP tool wrapper over the existing CADOps agent adapter. It
keeps `@web-cad/agent-adapter` as the internal API boundary and does not define
CAD operations itself.

It exposes these MCP-style tools:

- `cad.project_summary`
- `cad.object_measurements`
- `cad.project_extents`
- `cad.transaction_history`
- `cad.batch`

It does not depend on React, the renderer, OCCT, OPFS, STEP import/export,
WebGPU, natural-language parsing, or the web app startup path.

## Boundary

The MCP wrapper accepts MCP-style tool calls, translates them into existing agent
adapter calls, and returns structured adapter responses.

```text
MCP client
  -> cad.project_summary / cad.object_measurements / cad.project_extents / cad.transaction_history / cad.batch
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

Call `cad.object_measurements`:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
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
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "cad.project_extents",
    "arguments": {}
  }
}
```

Call `cad.transaction_history`:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
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
  "id": 6,
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

Commit uses the same `cad.batch` tool with `"mode": "commit"`. Callers can
provide optional actor metadata either inside the batch or as a top-level tool
argument:

```json
{
  "name": "cad.batch",
  "arguments": {
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
    "warnings": []
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
when present. Units are metadata-only in the current model; changing units does
not convert stored dimensions.

Measurement responses are read-only derived data from the authoritative
document, not renderer meshes. Current measurements support boxes and cylinders
and include local bounds, world bounds, and approximate volume.
