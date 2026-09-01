# V23 Slice D Agent/MCP Gate

Status: **Passed (2026-09-01).**

The connected agent now accepts the existing protocol XOR for
`selection.referenceCandidates`: either a durable `selection` or browser-owned
`currentTopologyEvidence`. The existing `cad.selection_reference_candidates`
tool passes that query through and returns cad-core's sanitized
`currentTopology` projection. Raw exact local IDs and entity signatures do not
appear in public structured content.

The existing `cad.batch` tool accepts the same slice B CADOps used by slice C:

1. `topology.checkpoint.create`
2. `topology.anchor.create` with omitted `stableId`
3. the consuming `sketch.createOnFace` or `feature.chamfer` op

Both sequences commit as one transaction. A subsequent query resolves the
public topology-anchor ID with `existingAnchorMatch`. Vertices remain
inspect-only, and unlisted face/edge operation pairs remain blocked.

## Validation

The following focused commands passed in this run:

```sh
pnpm --filter @web-cad/mcp-adapter exec vitest run src/v23PromotionMcp.test.ts
pnpm --filter @web-cad/mcp-adapter exec vitest run src/index.test.ts src/v23PromotionMcp.test.ts
pnpm --filter @web-cad/agent-adapter typecheck
pnpm --filter @web-cad/mcp-adapter typecheck
pnpm dev
```

`v23PromotionMcp.test.ts` passed 5 tests through real
`CadMcpServer.callTool` calls. It covers all frozen face and edge Must rows,
public-response privacy, vertex inspect-only behavior, blocked unlisted pairs,
one-transaction face and edge promotion/consumption, the public anchor match,
the frozen tool list, approval modes, batch modes, and package/schema
readiness.
The Vite development app also started successfully on its available local
port.

## Scope

The MCP tool names remain unchanged: this slice uses
`cad.selection_reference_candidates` and `cad.batch`. `CadMcpToolName` is
frozen. Approval modes remain `manualApproval` and `approveAll`; batch modes
remain `dryRun` and `commit`. No CadOp, MCP tool, package, schema, `.wcad`
version, dependency, Playwright suite, named closer, or smoke runner changed.
`topology.anchorCreationPlan` remains unchanged. Package identity remains
`partbench.wcad.v2`, with the existing `web-cad.project.v16` through
`web-cad.project.v22` readiness range.

Slice E remains the closer and owns `smoke:v23-promotion-workflow`. No release
plan amendment is needed.
