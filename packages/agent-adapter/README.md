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
  "permissions": {
    "allowCommit": false
  },
  "actor": {
    "type": "agent",
    "id": "local-agent",
    "name": "Local Agent"
  },
  "source": {
    "source": "agent",
    "toolName": "local-agent-tool"
  },
  "batch": {
    "version": "cadops.v1",
    "mode": "dryRun",
    "ops": [
      {
        "op": "scene.createBox",
        "id": "box_from_agent",
        "name": "Agent box",
        "dimensions": { "width": 10, "height": 20, "depth": 30 }
      },
      {
        "op": "document.updateUnits",
        "units": "in"
      }
    ]
  }
}
```

Read/query requests and dry-run batches are allowed by default. Commit batches
require an explicit adapter permission:

```json
{
  "permissions": {
    "allowCommit": true
  }
}
```

This is an adapter boundary policy, not an auth system. It prevents accidental
commits by structured agents and transports while leaving CADOps as the shared
internal command API.

`actor` is optional. If neither the request nor the batch supplies actor
metadata, the adapter marks committed transactions as an agent-adapter commit.
Actor metadata is stored on committed `cad-core` transactions for auditability;
it is not an authorization system.

The adapter also attaches generic audit metadata to each batch response and to
committed transactions where practical: request source, request ID, tool name,
intent (`dryRun` or `commit`), and operation count. Transaction history exposes
that audit metadata alongside actor metadata.

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

Measurement and extent queries use the same read-only query envelope:

```json
{
  "requestId": "agent_query_003",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "object.measurements", "id": "box_from_agent" }
  }
}
```

```json
{
  "requestId": "agent_query_004",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "project.extents" }
  }
}
```

Feature summaries use the same read-only query envelope. The current
implementation returns primitive-derived features from scene objects and
authored sketch-extrude features from the source-of-truth document:

```json
{
  "requestId": "agent_query_005",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "project.features" }
  }
}
```

The V2 structure bridge uses the same read-only envelope and returns the
default part, primitive-derived features/bodies, authored sketch-extrude
features/bodies, and source mappings for the current model:

```json
{
  "requestId": "agent_query_006",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "project.structure" }
  }
}
```

Sketch queries use the same read-only envelope. Sketches are source-of-truth V2
document data, not renderer geometry:

```json
{
  "requestId": "agent_query_007",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "project.sketches" }
  }
}
```

```json
{
  "requestId": "agent_query_008",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "sketch.get", "id": "sketch_1" }
  }
}
```

Transaction history uses the same read-only query envelope and returns summaries
of the existing `cad-core` transaction model:

```json
{
  "requestId": "agent_query_009",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "query": {
    "version": "cadops.v1",
    "query": { "query": "transaction.history" }
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
  "warnings": [],
  "audit": {
    "source": "agent-adapter",
    "requestId": "agent_req_001",
    "intent": "dryRun",
    "operationCount": 2
  }
}
```

Commit responses include `transactionId` when the batch commits.
When actor metadata is present on a committed transaction, commit responses also
include the committed `actor`. Commit responses also include the stored `audit`
metadata.

Validation failures keep the same shape and include `error` plus `errors`.
CADOps validation errors include stable codes plus structured context such as
operation name, JSON-style path, expected value shape, received value, operation
index, and affected object ID where practical.
Adapter permission failures use a stable `COMMIT_NOT_ALLOWED` code and do not
mutate the document.

Project summary queries return a serializable object list:

```json
{
  "ok": true,
  "requestId": "agent_query_001",
  "adapterVersion": "web-cad.agent-adapter.v1",
  "cadOpsVersion": "cadops.v1",
  "query": "project.summary",
  "units": "in",
  "objectCount": 1,
  "objects": [
    {
      "id": "box_from_agent",
      "kind": "box",
      "name": "Agent box",
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

Document unit changes are handled by CADOps in `cad-core`, not by the adapter.
Callers can use `document.updateUnits` with `mode: "metadataOnly"` to relabel
numeric values or `mode: "preservePhysicalSize"` to scale current dimensions and
transform translations.

Measurement queries are derived from the authoritative document, not renderer
meshes. Current measurements support boxes, cylinders, spheres, cones, and tori
and include local bounds, transformed world bounds, and approximate volume.

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
