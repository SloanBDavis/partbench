# V23 Slice A Persist Gate

Status: **Passed (2026-09-01).**

The existing V13 CADOps persist both required entity kinds without a new
fixture or production change. `topology.checkpoint.create` writes the existing
`CadTopologyCheckpointSourceRecord`, and `topology.anchor.create` writes
`CadTopologyAnchorSourceRecord` entries with `entityKind: "face"` and
`entityKind: "edge"`. The edge proof omits `stableId`, confirming that the
field remains optional for unmatched current-exact persistence.

## Validation

The following focused command passed in this run:

```sh
pnpm --filter @web-cad/cad-core exec vitest run src/index.test.ts -t "plans topology checkpoint and anchor CADOps for an exact-bound generated reference without mutating source|round-trips command-created topology checkpoints before anchor creation|creates topology anchors with dry-run safety, semantic diffs, undo, and redo|reports imported body topology anchor cut and add readiness from checkpoint proof|creates imported body chamfer and fillet features from exact topology edge anchors"
```

Vitest passed one file and all five selected tests; 442 unrelated tests were
skipped. Together they prove checkpoint creation and round-trip, face-anchor
batch planning and persistence, face-anchor persistence without a generated
stable ID, edge-anchor persistence without a generated stable ID, semantic
diffs, dry-run safety, undo/redo, and use of the persisted exact anchors.

## Scope

No collector was enabled. No production source, project schema, `.wcad`
version, CadOp, MCP tool, renderer, approval mode, package, dependency, smoke
runner, or browser gauntlet changed. Topology identity remains
`web-cad.project.v18` / `partbench.wcad.v2`; the project schema remains
minimum-triggered through `web-cad.project.v22`; and product SHA remains
`64ed45c`.

Slice B may add cad-core promotion. It may not change the project schema or
`.wcad` version because this gate found no persistence gap.
