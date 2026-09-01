# V23 Slice C Human Apply Gate

Status: **Passed (2026-09-01).**

Picking a commandable current exact face or edge is not a dead end. The
browser queries `selection.referenceCandidates` with the active Must
collector as `requiredOperation`. One preview/Apply batch creates a
checkpoint when needed, an omitted-`stableId` topology anchor, and the
consuming feature op. Sketch-on-face uses the same one-commit B batch.
Vertices stay inspect-only. Unlisted kind/action pairs stay
non-commandable. Preview/grip still runs on the consuming feature after
promotion because `planExactFeaturePreview` prepends the same prefix.

Human UI submits the same CADOps slice B defined. There is no second query
seam. `topology.anchorCreationPlan` still requires a generated `stableId`
and is not used for unmatched current-exact promotion. Raw local IDs never
enter labels, commands, diffs, JSON, or `.wcad`. Durable identity is the
public topology-anchor ID.

## Validation

The following focused commands passed in this run:

```sh
pnpm --filter @web-cad/web exec vitest run src/currentExactPromotionApply.test.ts src/modes/solid/exactFeaturePreviewPlan.test.ts src/viewportExactCandidateAnnouncement.test.ts src/sketchOnFacePromotion.test.ts
pnpm --filter @web-cad/web typecheck
pnpm dev
```

Vitest passed 51 tests across the four files. Web typecheck passed. Schema
remains `web-cad.project.v22` / `partbench.wcad.v2`.

## Scope

No collector inventory was widened. No Playwright suite, named closer
smoke, schema, `.wcad` version, cad-core, cad-protocol, package.json, MCP
tool, renderer, approval mode, or production dependency changed. Product
SHA moves off `64ed45c`; this gate does not invent a replacement SHA.
MCP/agent remains Slice D. `topology.anchorCreationPlan` still requires a
generated `stableId`.
