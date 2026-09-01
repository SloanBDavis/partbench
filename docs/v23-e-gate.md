# V23 Slice E Close Gate

Status: **Passed (2026-09-01).**

The named closer `pnpm smoke:v23-promotion-workflow` is green. It composes
the existing B/C/D proofs: unmatched current exact promotion, one-Apply
consume, blocked unlisted pairs, vertex inspect-only, and the same batch
through MCP/agent. It is not a V22 replay.

Human UI and MCP submit the same CADOps. Vertices remain inspect-only.
Product SHA moves to this close commit. V22 stays closed.

## Validation

The following named command passed in this run:

```sh
pnpm smoke:v23-promotion-workflow
```

Recorded counts from this run:

- cad-core `src/v23Promotion.test.ts`: 1 file, **10 passed**
- web four files (`currentExactPromotionApply.test.ts`,
  `exactFeaturePreviewPlan.test.ts`,
  `viewportExactCandidateAnnouncement.test.ts`,
  `sketchOnFacePromotion.test.ts`): 4 files, **52 passed**
- mcp-adapter `src/v23PromotionMcp.test.ts`: 1 file, **5 passed**

`pnpm dev` started. Vite v7.3.3 was ready in 171 ms on
`http://localhost:5173/` and served the app HTML with HTTP 200. The dev
server was then stopped.

## Scope

No new CadOp, MCP tool, schema, `.wcad` version, package, production
dependency, or Playwright suite. No second query seam. `CadMcpToolName`
still has 49 tools ending `cad.selection_reference_candidates`,
`cad.get_selection`, `cad.transaction_history`, `cad.batch`. Approval modes
stay `manualApproval` / `approveAll`. Schema stays `web-cad.project.v22` /
`partbench.wcad.v2`. `topology.anchorCreationPlan` still requires a generated
`stableId`.
