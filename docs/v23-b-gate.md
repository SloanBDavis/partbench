# V23 Slice B Cad-core Promotion Gate

Status: **Passed (2026-09-01).**

Unmatched current-exact face and edge promotion writes CADOps directly:

1. `topology.checkpoint.create`
2. `topology.anchor.create` with omitted `stableId`
3. consuming feature op using `topologyAnchorId` / `topologyAnchor` refs

`topology.anchorCreationPlan` still requires a generated `stableId` and is not
extended. Collectors stay UI-off. No new CadOp, schema, `.wcad` version,
package, MCP tool, or smoke runner. Product SHA remains `64ed45c`. Schema
remains `web-cad.project.v22` / `partbench.wcad.v2`.

## Validation

The following focused commands passed in this run:

```sh
pnpm --filter @web-cad/cad-core exec vitest run src/v23Promotion.test.ts
pnpm --filter @web-cad/cad-core exec vitest run src/index.test.ts -t "resolves current exact evidence only through verified durable matches|resolves a current exact entity to an existing active topology anchor|rejects mixed or widened current topology evidence query shapes"
pnpm --filter @web-cad/cad-protocol exec vitest run src/index.test.ts -t "freezes the V22 current-topology query seam and public projection"
pnpm --filter @web-cad/cad-core typecheck
pnpm --filter @web-cad/cad-protocol typecheck
pnpm --filter @web-cad/cad-core exec vitest run src/index.test.ts src/v23Promotion.test.ts
```

`v23Promotion.test.ts` passed 10 tests. Combined `index.test.ts` +
`v23Promotion.test.ts` passed 457 tests. Cad-core and cad-protocol typecheck
passed.

## Scope

No collector UI was enabled. No production CadOp, project schema, `.wcad`
version, MCP tool, renderer, approval mode, package, dependency, smoke runner,
or browser gauntlet changed. Topology identity remains
`web-cad.project.v18` / `partbench.wcad.v2`; the project schema remains
minimum-triggered through `web-cad.project.v22`; and product SHA remains
`64ed45c`.

Slice C may add human Apply. It may not change the project schema or `.wcad`
version because slice A found no persistence gap and this gate did not add one.
