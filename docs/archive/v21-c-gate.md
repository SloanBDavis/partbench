# V21 Gate C Canonical Exact-Body Resolver Evidence

Recorded: **2026-08-01**  
Exact primitive commit: `f969670bda3f3cc66f6c2d11d3afeb7f18c6b759`  
Canonical resolver commit: `779b2d438b8c912e99327269592503c84f4d3f6b`

## Result

The production browser app now discovers current exact sources through one
canonical resolver. Its dispatch is compile-time exhaustive over the frozen A2
policy for all 13 `CadBodySource["type"]` members. Results are sorted by body
ID, active bodies resolve once, consumed bodies remain excluded, and lifecycle
failures retain the bounded pending/stale/blocked/failed/unsupported vocabulary.
The existing display and exact-metadata services remain the execution path; the
historical export recipe stays compatibility-only until the artifact/writer
migration in Slices D-E.

Box, cylinder, sphere, cone, and torus bodies now use exact OCCT sources with
their current dimensions and full translation/rotation/non-zero scale. The
geometry-kernel validates primitive trust-boundary input, and OCCT builds and
affinely transforms centered primitive shapes before reading exact bounds,
mass properties, inertia, and topology. Authored extrude/revolve/sweep/loft,
hole, edge-finish, pattern, mirror, and shell sources reuse the existing
production source builders and placement/reference resolution.

Imported and checkpoint-backed leaves require one matching active checkpoint,
matching body/feature ownership, one matching payload, and exact B-rep byte
length plus SHA-256 evidence. Missing, duplicated, stale, unsupported, failed,
or corrupt evidence blocks before OCCT parsing. Verified checkpoint targets
cover the completed add/cut/chamfer/fillet rows and authored topology-backed
holes. The A2 imported-hole intersection remains empty and is explicitly
unsupported, so internal B-rep support does not widen cad-core commandability.

Exact source graphs are traversed iteratively, reject cycles and duplicate
semantic ownership, and stop at the shared 4,096-node limit. Cache identity
binds every geometry-affecting source field, current body source/topology
identity, checkpoint identity, B-rep length, and B-rep SHA-256 through the
existing synchronous SHA-256 implementation. `.wcad` load and STEP import now
carry existing manifest/import B-rep evidence into the session-only resolver
input; no artifact bytes entered document source or public adapter payloads.

## Checks

- `@web-cad/web`: 992 tests passed across 117 files; typecheck passed.
- `@web-cad/cad-core`: 1,111 tests passed across 55 files; typecheck passed.
- `@web-cad/geometry-kernel`: 88 tests passed; typecheck passed.
- `@web-cad/occt-wasm`: 108 tests passed across 2 files; typecheck passed.
- Real OCCT/WASM proof covered all five primitives and a rotated,
  non-uniformly scaled, translated box.
- Resolver proof covered every active V21 release fixture, completed pattern,
  mirror, and shell families, checkpoint corruption/status failures,
  imported downstream results, authored checkpoint holes, imported-hole
  exclusion, cycles, duplicate ownership, and the 4,096-node cap.
- Prettier and `git diff --check` passed.

Gate C is complete. Slice D may materialize transient identity-bound exact body
artifacts from these sources; no STEP writer migration or new persistence was
included here.
