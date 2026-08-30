# V22 Implementation DAG: Precision Interaction and Recovery

Status: **Approved — implementation authorized (2026-08-03).**

This document turns [`docs/v22.md`](./v22.md) into the binding landing order
and frozen fixture contract. V22 remains authoritative for behavior, limits,
non-goals, and Definition of Done; this DAG is authoritative for dependencies,
gates, command mapping, and evidence. Slice A changes no production behavior.

V22 has no Stretch work. Slices A–I land in order. No slice may widen a
completed command, source, persistence, renderer, package, dependency, or
approval contract.

## Low-Spec Working Rules

1. Keep each change typed with focused tests green. Run real OCCT, browser,
   OPFS, performance, bundle, and repository-wide commands serially.
2. Reuse V18 interaction/accessibility ownership, V19 dimensions, V20 approval
   modes, and V21/V21.1 exact resolver, identity, worker, topology, `.wcad`,
   and recovery/open paths.
3. Cad-core owns lifecycle, existing operation eligibility, durable-reference
   legality, transactions, and semantic diffs. Browser session owns interaction
   state, preview, annotations, pins, section, guards, and recovery scheduling.
4. One current exact shape lifetime supplies topology, display mesh, and private
   pick map. A display hit is never source or durable without existing explicit
   generated-reference/topology-anchor promotion.
5. Start with body-bound rejection plus bounded direct triangle scan. A private
   acceleration index needs a recorded hover-gate miss; it never authorizes a
   renderer rewrite, general BVH, or dependency.
6. Verify source revision and identity before and after each async pick,
   preview, measurement, recovery export/validation, and Restore. Failed,
   cancelled, and stale work neither changes source nor applies UI.
7. Keep derived/session data out of history, redo, JSON, `.wcad`, checkpoints,
   exact cache, agents/MCP, semantic diffs, and visible private IDs. Recovery
   alone is browser-owned ordinary `.wcad` v2.
8. No production dependency, workspace package, schema, `.wcad` version,
   renderer, generic preview/job/storage framework, agent file authority, or
   approval mode is added. Modes remain `manualApproval` and `approveAll`.
9. Bundle sizes may be measured as informational evidence with the unchanged
   V21.1 formula. They are not a fail-the-release or per-gate tripwire. No
   minifier, metric, or production-dependency cheat is permitted. Dynamic
   imports protect empty-project and ordinary sketch startup. Replacement
   slices delete the superseded exact-ready pick and pair-measurement
   branches in the same landing change. V21.1 gzip ceilings and inherited
   worker/WASM overages are not remaining Must items.

## Dependency Graph

```text
A1 baseline + A2 frozen contracts/fixtures + A3 commandability baseline
  -> Gate A
  -> B1 same-shape pick map -> B2 validation/transfer -> B3 limits/cleanup
  -> Gate B
  -> C1 depth hits -> C2 semantic evidence -> C3 filter/cycle/keyboard
  -> Gate C
  -> D1 collector matching -> D2 explicit promotion -> D3 diagnostics
  -> Gate D
  -> E1 disposable projection -> E2 one preview job -> E3 grips/Apply parity
  -> Gate E
  -> F1 sketch annotations -> F2 measurements/pins -> F3 display section
  -> Gate F
  -> G1 dirty guards -> G2 two-generation recovery -> G3 Restore/Discard
  -> Gate G
  -> H1 accessibility/stale/memory -> H2 deferral/compatibility audit
  -> Gate H
  -> I1 named release workflows -> I2 reconciliation/non-goal audit
  -> Gate I / release
```

## Slice A — Baseline, Contracts, and Frozen Matrices

### A1 — Baseline

- record inherited V18–V21.1 named commands, repository validation, and
  release browser/device environment;
- record inherited gzip sizes as informational history, not blocking
  budgets;
- freeze the per-slice deletion plan: C replaces exact-ready generated
  face/edge reconstruction, F replaces approximate subentity pair measurement,
  G reuses existing `.wcad`/OPFS primitives, and D extends the existing command
  worker query dispatch without adding an unmetered worker;
- classify pre-existing failures before production changes; and
- confirm unchanged manifests, schema, `.wcad` v2, workspace shape, approval
  values, exact-cache boundary, and agent file authority.

### A2 — Bounded Contract Inventory

- freeze `selection.referenceCandidates` as the only query seam: its request
  gets a mutually exclusive `currentTopologyEvidence` member while
  `CadSelectionReferenceInput`, `CadTopologyCommandTargetInput`, existing
  viewport-hit members, and every command/source member remain unchanged;
- freeze byte-free current-topology evidence/candidate outcomes: selectable,
  inspect-only, `existingGeneratedMatch`, `existingAnchorMatch`,
  `promotableGeneratedMatch`, blocked, stale, missing, ambiguous, and
  resource-limited, and unsupported;
- freeze private pick-map validation: matching body/source/topology/entity
  signatures; finite bounded counts/ranges; non-overlapping face ranges; and
  transfer-only typed data;
- freeze exact measurement request/response evidence and public diagnostics;
- reject renderer IDs, triangle indices, pick offsets, mesh coordinates,
  B-rep bytes, OCCT handles, OPFS names, paths, URLs, blobs, and file handles
  from every new V22 evidence/measurement, authoritative, visible, and agent
  field; grandfathered private viewport-hit inputs receive no-egress tests; and
- retain all existing `CadOp`s, operation matrices, semantic diffs, schemas,
  and package versions.

### A3 — Commandability Baseline Reuse

- implement no new commandability policy: reuse V21.1 lifecycle/reference/
  operation projections;
- freeze the 13-source × body/face/edge/vertex selection matrix below;
- freeze commandability separately by each completed collector: selected targets
  remain their existing commandable row or inspect-only/blocked with a reason;
- permit `promotableGeneratedMatch` only for body/face/edge entities already
  matched to an existing generated stable ID; arbitrary exact local IDs and
  current exact vertices never become anchors;
- require the existing checkpoint/anchor planning CADOps and consuming feature
  op in the normal transactional Apply batch for durable use; and
- prove selection, preview, measurement, grips, pins, annotations, section,
  recovery, and derived evidence never widen an operation row or mutate source.

### Gate A

Requires recorded baseline; test-only frozen contract/rejection fixtures;
exhaustive source × selectable-kind and collector parity fixtures; the
superseded-path deletion plan; affected typechecks; touched lint/format; and
`git diff --check`. Slice A adds no exported protocol member, pick, renderer,
preview, recovery, or product behavior; additive query contracts land with D.

## Frozen 13 × Selection Matrix

`CadBodySource["type"]` has 13 members. Adding one requires an approved plan
amendment and four explicit fixture decisions. `Must` means selectable,
highlightable, inspectable, filterable, cycleable, and keyboard reachable only
when active, healthy, current, exact-ready, identity-bound, and within limits.
Missing/invalid pick data permits truthful body-only fallback.

| Body source | Frozen fixture cases | Body | Face | Edge | Vertex |
| --- | --- | --- | --- | --- | --- |
| `primitiveFeature` | box, cylinder, sphere, cone, torus | Must | Must | Must | Must |
| `sketchExtrudeFeature` | entity/wire/region; supported new/add/cut | Must | Must | Must | Must |
| `sketchRevolveFeature` | entity/wire/one-region | Must | Must | Must | Must |
| `sketchHoleFeature` | blind/through-all, both directions, recursive | Must | Must | Must | Must |
| `edgeChamferFeature` | generated/named/topology/imported edge | Must | Must | Must | Must |
| `edgeFilletFeature` | generated/named/topology/imported edge | Must | Must | Must | Must |
| `linearPatternFeature` | global/generated/named/topology direction, recursive | Must | Must | Must | Must |
| `circularPatternFeature` | global/generated/named/topology axis, recursive | Must | Must | Must | Must |
| `mirrorFeature` | standard/generated/named/topology plane, recursive | Must | Must | Must | Must |
| `shellFeature` | closed and generated/named/topology open face | Must | Must | Must | Must |
| `sweepFeature` | line, arc, open G1 line/arc chain | Must | Must | Must | Must |
| `loftFeature` | supported separated entity sections | Must | Must | Must | Must |
| `importedStepBody` | solid, compound, recovered checkpoint downstream | Must | Must | Must | Must |

This is selection, not commandability. Existing consumed, stale, failed,
repair-needed, missing-payload, unsupported, duplicate-owned, cyclic,
over-limit, and identity-mismatched blockers remain. Arbitrary exact targets
remain inspect-only unless their completed operation row already accepts them.

## Frozen Collector Handoff Inventory

The current exact entity first resolves to `existingGeneratedMatch`,
`existingAnchorMatch`, `promotableGeneratedMatch`, or `inspectOnly`. Only the
first three may enter an existing collector, and promotion requires an existing
generated stable-ID match. Every unlisted kind/action pair is inspect-only.

| Kind | Existing collector | Existing durable form | Existing consuming CADOps |
| --- | --- | --- | --- |
| Body | Extrude add/cut target | `targetBodyId` or the completed body-anchor row | `feature.extrude` |
| Body | Hole target | `targetBodyId` or existing `targetTopologyAnchorId` | `feature.hole`, `feature.updateHole` |
| Body | Linear/circular pattern or mirror seed | `seedBodyId` under V21.1 policy | `feature.linearPattern`, `feature.circularPattern`, `feature.mirror` |
| Body | Shell target | `targetBodyId` under the exact single-solid policy | `feature.shell` |
| Face | Sketch-on-face | planar generated/named/active-anchor face | `sketch.createOnFace` |
| Face | Shell open face | generated/named/active-anchor face | `feature.shell`, `feature.updateShell` |
| Face | Mirror plane | planar generated/named/active-anchor face, optional existing offset | `feature.mirror`, `feature.updateMirror` |
| Edge | Chamfer/fillet target | eligible generated/named/active-anchor edge | `feature.chamfer`, `feature.fillet` |
| Edge | Linear-pattern direction/circular-pattern axis | linear generated/named/active-anchor edge or existing global axis | `feature.linearPattern`, `feature.updateLinearPattern`, `feature.circularPattern`, `feature.updateCircularPattern` |
| Body/face/edge/vertex | Name existing generated reference | existing generated stable ID only | `reference.nameGenerated` |
| Vertex | Inspect/measure only | no generic V22 anchor promotion; arbitrary current exact vertex is inspect-only | none |

Selection and measurement themselves submit no CADOps. Geometry-dependent
body policies, planar/linear checks, lifecycle, reference health, and every
completed source/operation matrix remain authoritative. A matched body/face/
edge that needs promotion commits the existing checkpoint/anchor planning ops
and consuming feature op together; raw local IDs never enter that batch.

## Frozen Preview, Grip, and Measurement Matrices

| Existing feature family | Create | Update | Direct grip fields |
| --- | --- | --- | --- |
| Extrude: completed entity/wire/region and add/cut rows | Must | Must | Depth |
| Revolve: completed entity/wire/region rows | Must | Must | Angle |
| Circular blind/through-all hole on V21.1 targets | Must | Must | Blind depth only |
| Chamfer | Must | Must | Distance |
| Fillet | Must | Must | Radius |
| Linear pattern | Must | Must | Spacing; count via grip value editor |
| Circular pattern | Must | Must | Total angle; count via grip value editor |
| Mirror | Must | Must | Plane offset |
| Shell | Must | Must | Wall thickness |
| Sweep in completed V17 matrix | Must | Must | None; editor preview only |
| Loft in completed V16/V17 matrix | Must | Must | None; editor preview only |
| Imported body, primitive compatibility, delete/suppress/reorder/unsupported | No new promise | No new promise | None |

Preview uses the same CADOps batch and pre-materialized IDs as Apply, dry-runs
and projects one disposable engine, resolves/tessellates the affected result,
and keeps one cancellable job. Meshes are ghosted/non-selectable; terminal paths
release resources; Apply reconstructs the live draft and revalidates. Bound
parameter/expression fields are read-only grips routed to their existing owner;
the right editor remains the complete accessible path.

| Single selection | V22 exact result |
| --- | --- |
| Body | Existing volume, surface area, centroid, bounds, inertia |
| Face | Area, surface class, normal/axis/radius when defined |
| Edge | Length, curve class, midpoint, radius when defined |
| Vertex | Model-space coordinates |

For two targets, `D` is exact minimum distance with closest points only when
one deterministic pair exists; `A` is exact supporting-plane/line angle.

| First × second | Body | Face | Edge | Vertex |
| --- | --- | --- | --- | --- |
| Body | Unavailable | Unavailable | Unavailable | Unavailable |
| Face | Unavailable | D; A only if both planar | D | D |
| Edge | Unavailable | D | D; A only if both linear | D |
| Vertex | Unavailable | D | D | D |

Supported pair targets are distinct current topology entities on the same or
different bodies. Every unsupported cell/angle returns a typed unavailable
result and no number; the current source-analytic center/vector approximation
is not retained as an exact fallback.

Measurements bind current identity before/after worker evaluation: at most two
targets, one job, 32 session-only pins. A non-unique closest-point solution
keeps the exact distance and omits points with a typed diagnostic. V19's full
existing dimension matrix
gets only bounded session on-canvas annotations (512 rendered; existing
`sketch.dimension.update`; no persisted layout or new family). One Inspect
display section plane (XY/XZ/YZ or current planar face, offset/flip) clips
drawing and candidates together, creates no source, and cannot select cut caps
or change exact measurement/export.

## Recovery, Accessibility, Resource, and Failure Fixtures

### Recovery and Replacement

- only committed dirty revisions coalesce ordinary `.wcad` v2 snapshots;
  drafts, previews, drags, and session state do not;
- recovery owns a third private OPFS namespace; derived-cache Clear and
  recovery Clear cannot remove each other's data;
- write/close/hash/ordinary-reader validate a new private generation before
  publish; a V22 byte/count ZIP preflight runs before the ordinary reader;
  retain one prior valid generation, at most two generations/one project;
- absent bounded marker opens no OPFS; Restore is explicit/atomic/checkpoint-
  aware and opens dirty; Discard confirms; and
- matching Save/Save As clears recovery only after identity match; editor guard
  precedes dirty replacement guard; New/Open/JSON/Restore use Save/Discard/
  Cancel; `beforeunload` warns while dirty and never begins async recovery.

### Accessibility and Interaction

- pointer and keyboard cover candidates, filters, cycling, additive selection,
  Escape, collector priority, and body fallback;
- labels announce kind, label, index/count, commandability, authority,
  truncation, pending/failure, and recovery without private IDs; and
- grips, annotations, measurements, section, recovery, and replacement prove
  focus, live regions, screen readers, reduced motion, high zoom, narrow layout,
  and focus restoration. Hover is never required.

### Limit and Adversarial Inventory

| Area | Required fixtures |
| --- | --- |
| Pick | invalid/overlap/kind/signature/count/NaN/overflow/source/topology/mesh mismatch; detached buffer; cancel/restart/stale; 250,000-scan bound; body fallback |
| Candidate UI | nearest-visible/occluded/clipped, DPR/zoom tolerance, ordering, 64-candidate truncation |
| Preview | every row; replacement/source/mode change; invalid/cancel; Apply/undo/redo; no dirty/cache/history/checkpoint write; cleanup |
| Inspection | each kind; cross-body distance; supported/unsupported angle; non-unique closest point; pin stale/clear; section invariants |
| Recovery | per-entry/package/entry-count/record/marker/aggregate limits; pre-publish interruption/orphan cleanup; unavailable/denied/full/quota; corrupt marker/package/version/source; stale write/reload; namespace/clear isolation; restore/discard/save guard |
| Deferral/security | empty/sketch startup; no eager OCCT/exact/preview/measurement/section/recovery; no base64/private-field exposure |

Limits: one preview; one Inspect measurement; 64 candidates; 512 annotations;
32 pins; one section; one recovery project/two generations; 128 MiB/map and
512 MiB retained maps; 250,000 synchronous triangle examinations; 512 MiB per
recovery generation, 1 GiB for both, 128 MiB per ZIP entry, 12,300 entries,
64 KiB generation record, 4 KiB marker; safe-integer sizes/ranges; and inherited
V21/V21.1 limits. Fail honestly: body-only pick, committed geometry retained,
no fabricated value, full-view section fallback, live project/prior recovery
kept.

## Landing Slices and Gates

### B — Same-Shape Pick Evidence

Create/validate/transfer/bound/cancel/dispose exact face ranges, edge polylines,
and vertex points from the same topology/tessellation lifetime for every matrix
row; no UI enablement.

**Gate B: [Passed (2026-08-04)](./v22-b-gate.md).** Real-OCCT proof covers
every fixture case listed in all 13 rows, corruption/limit/cancel/cleanup, and
no source persistence.

### C — Renderer Hits and Semantic Selection

Keep Canvas 2D; add depth-aware body/face triangles, edge polylines, vertex
points; validate private hits to current evidence; add Auto/Body/Face/Edge/
Vertex, cycle/list/keyboard, visual states, and body fallback.

**Gate C: [Passed (2026-08-07)](./v22-c-gate.md).** Selection matrix browser/renderer proof, occlusion/clipping,
DPR/zoom, candidate and 250,000-triangle work caps, stale fallback,
keyboard/accessibility, and hover p95 evidence. A missed direct-scan gate permits
only the measured private index already allowed by the release plan.

### D — Existing Collector Handoff

Reuse selection/reference/action projections for generated/anchor matching,
explicit promotion, current readiness, and diagnostics. Inspect-only never
enables forbidden action; commandable use stays normal transactional CADOps.

**Gate D: [Passed (2026-08-09)](./v22-d-gate.md).** Source × kind ×
existing-operation parity, promotion/Apply/undo/redo/save/open and
semantic-diff evidence passed without matrix widening.

### E — Exact Preview and Grips

Land disposable projection, one stale-safe job, frozen preview rows, ghost
display, grip/editor sync, binding routing, and Apply revalidation.

Preview and Apply preserve the inherited V21.1 source-authority epoch rule:
preview/dry-run proof is never commit preflight, and stale/cancelled/failed or
differently bound geometry preflight cannot be reused by Apply.

**Gate E: [Passed (2026-08-29)](./v22-e-gate.md).** Named closer
`pnpm smoke:v22-preview-grips-workflow` plus focused real-OCCT preview/Apply
same-shape parity. Disposable projection, one preview job, the frozen
preview/grip matrix, binding routing, Apply revalidation, and cleanup are
in that closer. Apply never consumes preview as commit proof. V21.1 gzip
ceilings and a production-browser gauntlet are not Gate E requirements.

### F — Sketch Annotations and Exact Inspection

Land existing V19 annotation editing, bounded exact measurement/pins, authority
copy, and one display-only section.

**Gate F:** dimension, single/pair, pin/stale, section/measurement/export,
keyboard/narrow/accessibility, and real-OCCT measurement proof.

### G — Dirty Guards and Recovery

Land lazy schedule/generation/status, Restore/Discard, matching-save cleanup,
shared replacement guard, and unload warning.

**Gate G:** production-browser OPFS interruption/reload/restore; every frozen
byte/count limit; denied/quota/corrupt/stale; namespace and Clear isolation;
checkpoint portability; guard/focus ordering; lazy startup.

### H — Cross-Cutting Audit

Audit accessibility, private text, stale paths, cleanup, restart, timings,
startup deferral, V18–V21.1 compatibility, and obsolete approximate
solid-pick branches.

**Gate H:** complete adversarial inventory, memory/performance, interaction
and accessibility via `pnpm smoke:v22-browser-workflow` when that command
exists, compatibility, and no partial non-goal evidence. Gzip ceilings are
not a Gate H Must.

### I — Release Proof and Reconciliation

Land named workflows/measurements and reconcile release records only after
implementation; record direct evidence for every V22 Must item.

**Gate I / release:** V22 named product workflows, inherited release
commands, full validation, Must ledger, and source/command/persistence/
private-field/non-goal audit. Gzip ceilings are not a Gate I Must.

## Named Command Mapping

| Command | Primary proof |
| --- | --- |
| `pnpm smoke:v22-exact-selection-workflow` | B–D: 13×4 selection, identity, occlusion, filters/cycle/keyboard, collector handoff |
| `pnpm smoke:v22-preview-grips-workflow` | E: preview/grip matrix, focused real-OCCT preview/Apply same-shape parity, bindings, cancel, cleanup |
| `pnpm smoke:v22-inspection-workflow` | F: annotations, measurement/pins, authority, section, accessibility |
| `pnpm smoke:v22-recovery-workflow` | G: generations, interruption, Restore/Discard, save cleanup, guards, OPFS faults |
| `pnpm smoke:v22-browser-workflow` | H: pointer/keyboard/focus/live regions, narrow/reduced-motion/high-zoom, stale/fallback |
| `pnpm smoke:v22-performance` | C/E/F/G/H: p50/p95, input, memory, restart, no >50 ms task |
| `pnpm check:v22-bundle` | Informational size record only; does not fail a gate or the release |

Focused package checks remain per-save; named commands run serially on the
release machine and are not the default save loop.

## Informational Bundle Measurement

V21.1 gzip ceilings are not a remaining Must. Inherited command-worker and
OCCT WASM overages are historical record, not work to recover. If sizes are
measured, use the unchanged V21.1 formula; do not change the minifier,
metric, or a production dependency to hide a number.

Recorded history: inherited baseline headroom was 1,492 gzip bytes critical
UI, 8 all-UI, 7 command worker, 29,171 geometry worker, and zero OCCT WASM.
Gate E measured +2,188 critical UI and +8,758 all-UI gzip versus Gate D;
command worker and OCCT WASM did not grow in E.

Deletion-first remains required when a slice replaces a superseded path:

- B stays on the existing lazy exact/geometry-worker path.
- C deletes superseded exact-ready generated-face/edge reconstruction while
  preserving only explicit historical/non-exact fallback rows.
- D extends `selection.referenceCandidates` in place; it adds neither a second
  query validator nor an unmetered command/query worker.
- F replaces, rather than retains beside it, the source-analytic subentity pair
  approximation.
- G reuses existing `.wcad`, hash, writable-stream, and OPFS primitives and
  creates no generic storage/cache stack.

## Evidence Rules and Gate Ledger

1. Each gate records command, fixture, environment, commit, and output/trace/
   metric/audit artifact. Mocks cannot close real OCCT, browser, or OPFS
   gates. Bundle size records are informational.
2. Record p50/p95 hit, preview validation/build, measurement, recovery
   serialize/write/validate/restore, interaction, retained bytes, and restart.
   Hover p95 <=16 ms; selection/filter/cycle <=50 ms; input next frame; no
   representative preview/measurement/recovery/section main-thread task >50 ms.
3. Each async proof includes success, cancel, stale, failure, disposal, and
   source invariants. Preview parity is same-shape B-rep/topology/mass/display,
   not byte-identical B-rep serialization.
4. Recovery evidence reports only last successfully captured revision. Private-
   field audit covers visible and accessible text, agents/MCP, diffs, user logs,
   JSON, and `.wcad`.
5. A failed required fixture blocks its gate. Contradictory OCCT/browser/OPFS/
   accessibility/security/performance evidence requires plan amendment and
   approval; no Must demotion or scope widening resolves it.
6. Low-spec repository validation is literal and serial: `pnpm test` already
   uses workspace concurrency 1; typechecks use
   `pnpm -r --workspace-concurrency=1 typecheck`; builds and every named
   browser, OCCT, and performance command run one at a time.

| Gate | Status | Closure evidence |
| --- | --- | --- |
| A | [Passed](./v22-a-gate.md) | inherited baseline, frozen contracts/matrices/fixtures, no production behavior |
| B | [Passed](./v22-b-gate.md) | same-shape pick maps, validation, transfer, bounds, cleanup, no source persistence |
| C | [Passed](./v22-c-gate.md) | depth-aware selection, fallback, filter/cycle/keyboard, performance |
| D | [Passed](./v22-d-gate.md) | collector/promotion path and exhaustive no-widening parity |
| E | [Passed](./v22-e-gate.md) | named closer `pnpm smoke:v22-preview-grips-workflow` plus focused real-OCCT preview/Apply same-shape parity; gzip-ceiling Must removed |
| F | Pending | V19 annotations and exact inspection/section/accessibility |
| G | Pending | atomic two-generation recovery and replacement/unload guards |
| H | Pending | accessibility/stale/memory/deferral/compatibility audit |
| I | Pending | named product workflows, inherited commands, full validation, Must/non-goal reconciliation |

End of V22 implementation DAG.
