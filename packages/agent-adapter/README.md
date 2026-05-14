# Agent Adapter Spike

This package is the Milestone 5 AI/MCP adapter spike. It exposes the existing
CADOps batch interface through a small JSON-callable adapter without changing the
internal CAD architecture.

It depends on:

- `@web-cad/cad-protocol`
- `@web-cad/cad-core`

It does not depend on React, the renderer, Open CASCADE, OPFS, STEP import/export,
WebGPU, or natural-language parsing.

## Boundary

External callers send a `CadOpsAgentRequest`:

```json
{
  "requestId": "agent_req_001",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "batch": {
    "version": "cadops.v1",
    "mode": "dryRun",
    "ops": [
      {
        "op": "scene.createBox",
        "id": "box_from_agent",
        "dimensions": { "width": 10, "height": 20, "depth": 30 }
      }
    ]
  }
}
```

The adapter delegates the `batch` directly to `CadEngine.executeBatch()`.
CADOps remains the internal API; MCP, SDKs, scripts, and future agent tools
should wrap this adapter rather than define their own CAD operation model.

## Responses

Dry-run and commit both return structured fields suitable for agents:

```json
{
  "ok": true,
  "requestId": "agent_req_001",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "cadOpsVersion": "cadops.v1",
  "mode": "dryRun",
  "createdIds": ["box_from_agent"],
  "modifiedIds": [],
  "deletedIds": [],
  "warnings": []
}
```

Commit responses include `transactionId` when the batch commits.

Validation failures keep the same shape and include `error` plus `errors`.

## Example Usage

```ts
import { CadOpsAgentAdapter } from "@web-cad/agent-adapter";

const adapter = new CadOpsAgentAdapter();
const responseJson = adapter.executeJson(JSON.stringify(request));
```

An MCP server can later expose this as a tool by accepting the same JSON request
and returning the same JSON response. That server should remain a transport
wrapper; it should not own the document model or define CAD commands.
