# V22 Gate C Evidence

Status: **Passed (2026-08-07).**

This record closes bounded exact viewport selection. The binding scope remains
in [`docs/v22.md`](./v22.md), and the frozen matrix and landing order remain in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md).

## Outcome

The existing Canvas 2D renderer now selects current exact body, face, edge, and
vertex evidence with deterministic depth ordering, CSS-pixel edge/vertex
tolerance, clipping, a 64-candidate cap, and the existing 250,000-triangle work
cap. Invalid, missing, stale, or resource-limited exact evidence retains the
ordinary body path without guessing a subentity.

Solid and Inspect expose the frozen Auto/Body/Face/Edge/Vertex filters. Pointer,
Shift-additive selection, the `N` cycle shortcut, and the native candidate list
share one bounded session. Moving outside tolerance or replacing the exact-body
identity resets that session. Visible and live-region copy announces kind,
human label, one-based index/count, visibility, and existing commandability
without exposing private IDs or signatures.

Slice C also removed the obsolete exact-ready generated face/edge reconstruction
branches as planned. The renderer-mesh bridge now accepts the already-supported
`sweep` and `loft` display-mesh tags; no geometry capability was added.

## Real browser matrix

`pnpm smoke:v22-exact-selection-workflow` passed end to end from the closure
worktree based on `fbc95297e0fc0eb54db3e8928aad1844ae675d53` at
`2026-08-07T19:53:15.074Z`. The retained JSONL record reports:

- Headless Chromium 151, worker started, OCCT WASM loaded;
- 13/13 source rows passed body/face/edge/vertex hits, exact identity binding,
  perspective occlusion, clipping, filters, and body-only fallback;
- OCCT load 7,258.8 ms, worker total 7,313.4 ms, and first round trip
  7,361.0 ms; and
- OCCT WASM 13,808,536 bytes gzip and 11,193,695 bytes Brotli.

The 13 rows are primitive, extrude, revolve, hole, chamfer, fillet, linear
pattern, circular pattern, mirror, shell, sweep, loft, and recovered imported
STEP. Gate B remains the exhaustive real-OCCT fixture-case proof within those
rows; Gate C consumes one representative from each frozen source family through
the browser renderer.

## Limits, failure, accessibility, and performance

Focused renderer tests prove depth/occlusion order, clipped candidate removal,
zoom-stable CSS tolerance, body-bound rejection, 64-candidate truncation, the
250,000 triangle/point hard stop, and identity-bound visual states. App tests
prove stale identity reset, absent/cancelled and resource-limited fallback,
bounded additive selection, cycle wrap/reset, byte-identical source/history
through hover/select/cycle, keyboard-native candidates, live announcements, and
private-ID redaction.

The first representative direct-scan measurement missed the gate at 33.78 ms
p95. The approved smallest private acceleration caches the existing projected
body bounds in a `WeakMap`; it adds no BVH, dependency, scene graph, or renderer.
The final named run measured 708 hover samples over four bodies and 34,560
triangles:

| Metric | Result | Gate |
| --- | ---: | ---: |
| Hover p50 | 4.52 ms | recorded |
| Hover p95 | 11.26 ms | <= 16 ms |
| Selection/list apply p50 | 0.0015 ms | recorded |
| Selection/list apply p95 | 0.0029 ms | <= 50 ms |
| Retained pick-array bytes | 16,576 | recorded |

## Validation

The following passed serially:

```sh
PARTBENCH_SMOKE_BROWSER_NO_SANDBOX=1 pnpm smoke:v22-exact-selection-workflow
pnpm --filter @web-cad/renderer-mesh-bridge test
pnpm --filter @web-cad/renderer-mesh-bridge typecheck
pnpm exec vitest run scripts/v22-hover-p95.test.mjs scripts/occt-smoke/records.test.mjs
pnpm --filter @web-cad/web exec vitest run src/viewportPickIntent.test.ts
pnpm --filter @web-cad/renderer typecheck
pnpm --filter @web-cad/web typecheck
pnpm lint
pnpm exec prettier --check <touched files>
git diff --check
```

The named workflow passed 27 renderer tests and 29 web tests before building
the geometry worker, running the real browser matrix, and enforcing hover p95.
Repository lint passed with zero errors and seven inherited Fast Refresh
warnings.

## Scope audit

- No CADOps command/query, authoritative source, semantic diff, schema, `.wcad`
  version, workspace package, production dependency, approval mode, cache
  format, agent authority, or completed commandability matrix changed.
- Pick maps, screen hits, candidate sessions, clip evidence, and projected-bound
  cache entries remain derived/session-only and do not enter persistence or
  agents/MCP.
- Gate C performs no durable reference promotion. Slice D remains responsible
  for current-topology query evidence and existing collector handoff.

Gate C is closed. Slice D may implement only the frozen current-evidence query,
existing reference matching/promotion, and collector handoff.
