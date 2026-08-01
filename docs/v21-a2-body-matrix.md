# V21 A2 Exact Body Matrix Evidence

Recorded: **2026-08-01**  
Implementation commit: `0a81ee33f39301c33388b0fde171da98e22e7fa4`

## Result

`V21_EXACT_BODY_SOURCE_POLICY` in the existing cad-core release fixture catalog
is compile-time exhaustive over all 13 `CadBodySource["type"]` members. A
separate exhaustive record maps all 13 active feature families back to those
source types. Adding a future union member without policy now fails typecheck;
runtime tests also require every source type to be produced by a committed,
round-trippable source fixture.

| Body source | Frozen completed matrix |
| --- | --- |
| `primitiveFeature` | Active box, cylinder, sphere, cone, and torus compatibility bodies |
| `sketchExtrudeFeature` | Entity, ordered-wire, and region `newBody`; completed entity/wire/region add/cut and topology-backed result chains |
| `sketchRevolveFeature` | Entity, valid ordered wire, or exactly one region in completed `newBody` modes |
| `sketchHoleFeature` | Blind/through-all, either direction, on completed extrude/result targets |
| `edgeChamferFeature` | Completed generated, named, or topology-proven eligible/result/imported edge |
| `edgeFilletFeature` | Same completed edge/target proof matrix as chamfer |
| `linearPatternFeature` | Extrude-family seed and completed V16 direction references |
| `circularPatternFeature` | Extrude-family seed and completed V16 rotation-axis references |
| `mirrorFeature` | Extrude-family seed and completed V16 plane references |
| `shellFeature` | Extrude-family target and completed open-face references |
| `sweepFeature` | Rectangle/circle profile on one line, one arc, or open ordered G1 line/arc chain |
| `loftFeature` | Two or more separated, roughly parallel rectangle/circle entity sections |
| `importedStepBody` | Identity/hash/topology-matching checkpoint solid or supported compound; completed anchored add/cut/chamfer/fillet/sketch-on-face consumers |

`V21_EXACT_BODY_MATRIX_ROWS` freezes the 19 active Must rows plus consumed and
blocked lifecycle rows. Every active row requires one exact artifact and one
STEP output. The shared invariant record requires fixture-exact body/solid
counts, exact ordered names and document units, equivalent bounds, volume,
surface area, centroid, and inertia, plus exact topology counts. Unit dimensions
are frozen as length¹, area², volume³, and inertia⁵ across `mm`, `cm`, `m`, and
`in`.

The lifecycle oracle is source-independent:

- active and healthy resolves as `ready`;
- consumed is excluded from Export all and never exported;
- pending, stale, repair-needed, and missing-checkpoint states block;
- current build failure reports `failed`; and
- a policy-excluded combination reports `unsupported`, regardless of derived
  evidence.

## Fixtures

The audit reuses the existing V7 and V15 release fixtures for entity extrude,
revolve, hole, edge finishes, consumed bodies, patterns, mirror, and shell. It
adds only the missing reusable source fixtures to `releaseSamples.ts`:

- all five primitive compatibility bodies;
- ordered-wire extrude, region-with-hole extrude, and region revolve;
- sweep plus separated attached-plane loft; and
- a resolved imported STEP body with an active checkpoint source record.

All four new fixtures pass dry-run without mutation, commit through CADOps,
round-trip through current project JSON, preserve their expected active body
IDs, and expose only the expected body-source discriminants. Synthetic source
checkpoint metadata is not treated as real OCCT evidence; Slice D/I owns the
real B-rep/hash/topology corpus.

## Completed-matrix boundaries

The approved V21 phrase “supported imported-body downstream ... hole” is read
through V21's binding completed-matrix qualifier. V15 completed imported
add/cut and anchored chamfer/fillet, but not imported-hole targeting. Therefore
the imported-hole intersection is empty: A2 includes an atomic negative dry-run
fixture expecting `UNSUPPORTED_FEATURE_OPERATION` and no source mutation. This
does not demote the positive hole Must row for completed authored/result-body
targets. Adding imported-hole modeling breadth would require an explicit future
plan amendment.

V16 also normatively limits pattern, mirror, and shell Must support to
extrude-family seeds/targets. Current cad-core validators accept some broader
authored bodies; A2 records that as implementation drift and freezes the narrow
V16 policy. Later exact work cannot use successful validation or OCCT execution
to widen the completed matrix.

## Checks

- `pnpm --filter @web-cad/cad-core typecheck` — passed.
- `pnpm --filter @web-cad/cad-core exec vitest run src/releaseSamples.test.ts --maxWorkers=1`
  — 30 passed.
- `pnpm --filter @web-cad/cad-core test` — 1,107 passed across 54 files.
- Prettier and `git diff --check` passed.

Gate A is complete: A0 is green, A1 proves the named AP242/unit path in the real
browser without a binding change, and A2 freezes every current source and
completed support row without adding CAD capability.
