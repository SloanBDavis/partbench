# Agent Adapter

This package exposes the existing CADOps batch and read/query interfaces through
a small JSON-callable adapter without changing the internal CAD architecture.

It depends on:

- `@web-cad/cad-protocol`
- `@web-cad/cad-core`

It does not depend on React, the renderer, Open CASCADE, OPFS, STEP import/export,
WebGPU, or natural-language parsing.

## Boundary

External callers submit mutations with a `CadOpsAgentRequest`:

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

External callers inspect the current model with a `CadOpsAgentQueryRequest`:

```json
{
  "requestId": "agent_query_001",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "project.summary" }
  }
}
```

Object lookup uses the same envelope:

```json
{
  "requestId": "agent_query_002",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "object.get", "id": "box_from_agent" }
  }
}
```

The adapter delegates batches directly to `CadEngine.executeBatch()` and queries
directly to `CadEngine.executeQuery()`. CADOps remains the internal API; MCP,
SDKs, scripts, and future agent tools should wrap this adapter rather than define
their own CAD operation model.

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

Project summary queries return a serializable object list:

```json
{
  "ok": true,
  "requestId": "agent_query_001",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "cadOpsVersion": "cadops.v1",
  "query": "project.summary",
  "objectCount": 1,
  "objects": [
    {
      "id": "box_from_agent",
      "kind": "box",
      "dimensions": { "width": 10, "height": 20, "depth": 30 },
      "transform": {
        "translation": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1]
      }
    }
  ]
}
```

Missing object lookups return `ok: false` with a structured `OBJECT_NOT_FOUND`
error.

## Example Usage

```ts
import { CadOpsAgentAdapter } from "@web-cad/agent-adapter";

const adapter = new CadOpsAgentAdapter();
const summaryJson = adapter.queryJson(JSON.stringify(summaryRequest));
const previewJson = adapter.executeJson(JSON.stringify(dryRunBatchRequest));
const commitJson = adapter.executeJson(JSON.stringify(commitBatchRequest));
```

An external agent should query before submitting a batch, run the proposed batch
in `dryRun`, inspect the returned IDs and warnings, and only then submit the same
operation set in `commit` mode when allowed.

An MCP server can later expose this as a tool by accepting the same JSON request
and returning the same JSON response. That server should remain a transport
wrapper; it should not own the document model or define CAD commands.
