# V22 Gate B Evidence

Status: **Passed (2026-08-04).**

This record closes same-shape private pick evidence before renderer selection is
enabled. The binding scope remains in [`docs/v22.md`](./v22.md), and the
landing order and frozen fixture contract remain in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md).

## Outcome

The existing exact-body artifact lifetime now derives one validated private
pick map beside its B-rep, topology snapshot, and display mesh. It carries
identity-bound face triangle ranges, edge polylines, and vertex points; uses
transferable typed arrays through the existing worker path; stays inside the
inherited aggregate exact-artifact cap; and is discarded rather than trusted
when corrupt. Slice B adds no UI selection behavior.

The semantic bridge also exposed and fixed two existing checkpoint/reference
identity defects: serialized topology checkpoints now retain the worker's raw
topology signature and `sourceKind`, and generated or named shell faces bind a
query-only topology copy without changing the exact artifact or pick map.

## Literal 13-row real-OCCT matrix

Every row below reaches the real OCCT artifact builder and asserts a valid,
nonempty, same-shape face/edge/vertex pick map. The authored matrix test is
`materializes every completed authored exact source family as a same-shape
artifact`; the CADOps/resolver test is `builds exact pick evidence for the
frozen semantic selector roots`.

| Frozen body-source row | Real-OCCT fixture evidence |
| --- | --- |
| `primitiveFeature` | Authored matrix: box, cylinder, sphere, cone, and torus. The browser corpus independently rebuilds all five. |
| `sketchExtrudeFeature` | Authored matrix: entity, composite wire, region, new, add, and cut. `maps wire-revolve and region add/cut release branches` and the existing composite-wire add/cut end-to-end tests close the distinct region branches. |
| `sketchRevolveFeature` | Authored matrix: entity and one-region; `maps wire-revolve and region add/cut release branches` supplies the wire case. |
| `sketchHoleFeature` | Authored matrix supplies blind and through-negative holes. `cuts universal artifact-hole targets in every retained mode with multi-solid atomicity` covers blind/through-all, positive/negative directions, recursive artifact targets, multi-solid atomicity, reparsing, and STEP round trip. |
| `edgeChamferFeature` | Authored matrix supplies the generated edge. The semantic bridge resolves generated, named, and topology-anchor CADOps through the public resolver. Imported-edge coverage is the existing real-OCCT `checkpointEdgeFinish` chamfer over a parsed checkpoint target plus the browser `imported-chamfer` checkpoint round trip. |
| `edgeFilletFeature` | Authored matrix supplies the generated edge. The semantic bridge resolves generated, named, and topology-anchor CADOps through the public resolver. Imported-edge coverage is the existing real-OCCT `checkpointEdgeFinish` fillet over a parsed checkpoint target plus the browser `imported-fillet` checkpoint round trip. |
| `linearPatternFeature` | Authored matrix supplies the exact pattern. The semantic bridge resolves recursive global-axis, generated-edge, named-edge, and topology-anchor directions. |
| `circularPatternFeature` | Authored matrix supplies the exact pattern. The semantic bridge resolves recursive global-axis, generated-edge, named-edge, and topology-anchor axes. |
| `mirrorFeature` | Authored matrix supplies the exact mirror. The semantic bridge resolves recursive standard-plane, generated-face, named-face, and topology-anchor planes. |
| `shellFeature` | Authored matrix supplies closed and generated-open shells. The semantic bridge resolves generated-face, named-face, and topology-anchor open faces and proves the artifact and pick map are not mutated during query binding. |
| `sweepFeature` | Authored matrix supplies line, signed arc, and open G1 line/arc-chain paths. |
| `loftFeature` | Authored matrix supplies supported separated entity sections. |
| `importedStepBody` | `builds verified checkpoint-backed downstream artifacts from the parsed target shape` supplies recovered checkpoint/imported artifacts. The browser corpus proves imported solid and compound round trips and the six imported checkpoint downstream rows. |

The semantic bridge has 22 globally distinct selector-root cases: six
chamfer/fillet, eight recursive linear/circular pattern, four recursive mirror,
and four shell cases. It creates real CADOps documents, exact generated and
named references, real checkpoint/anchor CADOps, resolves them through
`resolveCurrentExactBodies`, and builds artifacts through the in-process
geometry worker. All 22 source-identity signatures and cache keys are distinct.

## Validation, failure, and persistence evidence

The following focused checks passed serially on the low-spec release machine:

```sh
pnpm --filter @web-cad/geometry-kernel exec vitest run src/index.test.ts -t "materializes every completed authored exact source family as a same-shape artifact"
pnpm --filter @web-cad/geometry-kernel exec vitest run src/index.test.ts -t "maps wire-revolve and region add/cut release branches"
pnpm --filter @web-cad/geometry-kernel exec vitest run src/index.test.ts -t "builds verified checkpoint-backed downstream artifacts from the parsed target shape"
pnpm --filter @web-cad/geometry-kernel exec vitest run src/index.test.ts -t "runs a composite wire (add|cut) through mesh, exact metadata, topology, checkpoint, and STEP"
pnpm --filter @web-cad/geometry-kernel exec vitest run src/index.test.ts -t "rejects pick-map corruption before transfer"
pnpm --filter @web-cad/occt-wasm exec vitest run src/index.test.ts -t "keeps an exact artifact when optional pick-map bindings are unavailable"
pnpm --filter @web-cad/occt-wasm exec vitest run src/index.test.ts -t "cuts universal artifact-hole targets in every retained mode with multi-solid atomicity"
pnpm --filter @web-cad/web exec vitest run src/v22ExactPickSemanticBridge.test.ts
pnpm --filter @web-cad/web exec vitest run src/projectExactStepExport.test.ts
pnpm --filter @web-cad/web exec vitest run src/projectWcadTopologyCheckpoints.test.ts
pnpm --filter @web-cad/web exec vitest run src/exactArtifactOpfsCache.test.ts
pnpm --filter @web-cad/web exec vitest run src/browserGeometryWorker.test.ts
NODE_OPTIONS=--max-old-space-size=1536 MALLOC_ARENA_MAX=2 pnpm --filter @web-cad/web typecheck
PARTBENCH_REQUIRE_V21=1 PARTBENCH_SMOKE_BROWSER_NO_SANDBOX=1 NODE_OPTIONS=--max-old-space-size=768 MALLOC_ARENA_MAX=2 node scripts/smoke-occt-browser.mjs
```

The geometry-kernel corruption fixtures reject identity, topology, entity,
count, range, overlap, finite-number, and aggregate-size violations before
transfer while retaining a valid exact artifact as body-only fallback. Injected
OCCT allocation/meshing failures and resource-limit exits prove wrapper and
shape cleanup. The browser-worker test cancels started work, disposes its
worker, and succeeds on a fresh worker.

The OPFS test writes only the existing B-rep cache record, rebuilds the private
map after a validated read, and proves project JSON, checkpoint payloads, and
ordinary `.wcad` v2 bytes are unchanged before and after. Pick-map field names
are absent from the cache index, authoritative project export, checkpoint
payloads, and `.wcad` manifest. Browser export reports zero retained artifact
bytes and zero base64 calls.

## Browser record

The required browser workflow passed on commit
`fb3b83a5da490a1de836766b23d4ca81424b7e45` at
`2026-08-04T00:37:52.181Z`:

- Headless Chromium 151 started the geometry worker and loaded OCCT WASM;
- the 24-body exact corpus and six imported checkpoint downstream round trips
  completed with internal valid-pick-map assertions;
- OCCT load was 7,722.5 ms, worker execution 7,779.6 ms, and first round trip
  7,823.8 ms; and
- OCCT WASM remained 13.81 MB gzip and 11.19 MB Brotli.

## Scope audit

- No command, query, renderer contract, schema, `.wcad` version, package,
  dependency, approval mode, or completed source/operation matrix changed.
- Pick maps remain private, derived, byte-free outside the worker/artifact
  boundary, and unavailable to agents/MCP.
- No acceleration structure was added; Slice C starts with the planned bounded
  direct scan.
- Independent adversarial review accepted the 22 selector identities, raw
  checkpoint identity preservation, query-only shell binding, persistence
  exclusion, and reuse of the existing stable-face matcher with no remaining
  Gate B blocker.

Gate B is closed. Slice C may consume validated current pick evidence for
bounded renderer hits and semantic selection; it may not widen commandability.
