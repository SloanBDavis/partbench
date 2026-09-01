# V22 Gate D Evidence

Status: **Passed (2026-08-09).**

This record closes existing collector handoff. The binding scope remains in
[`docs/v22.md`](./v22.md), and the frozen matrices and landing order remain in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md).

## Outcome

`selection.referenceCandidates` now accepts exactly one of the existing
durable selection input or the frozen six-field current-topology evidence.
Cad-core verifies document source identity, existing generated references,
active topology anchors, lifecycle, and the requested existing operation. It
returns `existingGeneratedMatch`, `existingAnchorMatch`,
`promotableGeneratedMatch`, `inspectOnly`, or the bounded failure outcome
without returning raw exact local IDs or signatures.

The browser sends face, edge, and vertex current evidence through that query.
Only a resolved commandable generated target enters the existing modeling
selection context; body candidates retain the existing body-selection path.
Unmatched exact entities remain selectable but inspect-only. Promotion remains
explicit: the existing checkpoint/anchor planning CADOps and consuming feature
op are applied together by the existing transaction path. Selection itself
does not mutate source.

## Matrix and transaction proof

Gate A's frozen fixture still covers all 13 body sources and four selectable
kinds. The real browser workflow again passed body/face/edge/vertex selection
for all 13 rows. The Gate D cad-core parity fixture compares current exact face,
edge, and vertex handoff with the durable generated-reference path for every 13
existing `CadSelectionReferenceOperation` values; candidates, issues, and
status are identical. Unsupported kind/operation pairs remain blocked.

Focused promotion tests prove direct generated-face use, explicit result-face
checkpoint/anchor planning, reuse of an active anchor, and zero ops for an
unsupported face. Existing cad-core transaction tests prove dry-run, semantic
diff, Apply, undo, and redo for checkpoint/anchor commands. Existing browser
`.wcad` tests prove topology-anchor sketch attachments and planned selected
references survive normal save/open. The full cad-core suite passed 1,142
tests, including project history/redo and WCAD round trips.

## Real browser and performance evidence

The named `smoke:v22-exact-selection-workflow` command passed serially with
`PARTBENCH_SMOKE_BROWSER_NO_SANDBOX=1` from
`95d2695d9aae738ebe1af52156e253706955d285` using Headless Chromium 151. The
worker started, OCCT WASM loaded, and the 13-source V22 exact-selection matrix
passed. The retained run reported OCCT load 6,567.6 ms, worker total 6,619.8
ms, and first round trip 6,693.0 ms.

The same named run measured 708 hover samples over four bodies and 34,560
triangles: hover p50 was 3.78 ms and p95 was 10.45 ms against the 16 ms gate.
Selection/list apply p95 was 0.0041 ms. Retained candidate data was 16,576
bytes.

## Validation

The following passed serially:

```sh
pnpm --filter @web-cad/cad-core exec vitest run --no-file-parallelism
pnpm --filter @web-cad/cad-protocol test -- --no-file-parallelism
pnpm --filter @web-cad/agent-adapter exec vitest run --no-file-parallelism
pnpm --filter @web-cad/web exec vitest run \
  src/viewportExactSelectionSession.test.ts \
  src/viewportExactSelectionAppPath.test.ts \
  src/viewportExactCandidateAnnouncement.test.ts \
  src/viewportHoverIntent.test.ts src/viewportPickIntent.test.ts \
  src/viewportInteractionContract.test.ts src/viewportVisibleText.test.ts \
  src/sketchOnFacePromotion.test.ts --no-file-parallelism
pnpm --filter @web-cad/web exec vitest run \
  src/projectWcadTopologyCheckpoints.test.ts --no-file-parallelism
pnpm -r --workspace-concurrency=1 typecheck
pnpm check:v21-1-bundle
PARTBENCH_SMOKE_BROWSER_NO_SANDBOX=1 \
  pnpm smoke:v22-exact-selection-workflow
pnpm exec eslint <touched TypeScript files>
pnpm exec prettier --check <touched files>
git diff --check
```

The inherited fixed bundle gate passed without cap or minifier changes:

| Artifact | Gzip bytes | Fixed cap |
| --- | ---: | ---: |
| Critical UI JavaScript | 408,188 | 409,600 |
| All UI JavaScript | 563,168 | 563,200 |
| Command worker | 261,982 | 262,144 |
| Geometry worker | 95,897 | 122,880 |
| OCCT WASM | 13,808,536 | 13,808,536 |

## Scope audit

- No CadOp, completed operation row, project schema, `.wcad` version, workspace
  package, production dependency, approval mode, cache format, or agent file
  authority was added.
- Current exact evidence is query/session-only. Raw local IDs and signatures do
  not enter commands, semantic diffs, project JSON, `.wcad`, agents/MCP, or
  visible text.
- Arbitrary exact targets remain inspect-only; current exact vertices never
  promote. Promotion requires an existing generated stable-ID match and the
  completed checkpoint/anchor path.

Gate D is closed. Slice E may implement only the frozen disposable preview and
grip matrix with Apply revalidation and cleanup.
