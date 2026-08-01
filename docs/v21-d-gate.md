# V21 Gate D Identity-Bound Exact Artifact Evidence

Recorded: **2026-08-01**  
Artifact implementation commit: `291ce15653ecf252b6d9a46a4e3222f15d85ff54`

## Result

The geometry-kernel and worker now expose one internal, identity-bound exact
body artifact request. Each transient artifact binds the project, body, source,
cache, graph, units, and shape policy to one OCCT B-rep byte buffer plus its
length and SHA-256, exact metadata, topology snapshot, and generated-reference
evidence. The type is absent from project source, saved files, and public
agent/MCP payloads.

Every frozen V21 body-matrix source is built through one OCCT shape lifetime.
That shape is checked for nullness and B-rep validity, serialized once, and
used for metadata and topology. The real-OCCT matrix covers five transformed
primitives; rectangle, wire, and region extrudes; add/cut; rectangle and region
revolves; blind and through-negative holes; chamfer and fillet; linear and
circular patterns; mirror; shell; line, arc, and G1 sweeps; and loft. Wire
generated references are present in both metadata and topology.

Verified checkpoint B-reps support direct bodies plus the completed
checkpoint-backed add, cut, authored-hole, chamfer, and fillet rows. The stored
topology source kind and signature are re-derived from the parsed target before
downstream work. Imported-hole support remains excluded by the frozen matrix.
Explicit checkpoint creation now reuses the artifact builder and preserves its
checkpoint identity, B-rep bytes, topology, and signature package semantics;
it does not create source records.

Worker-side Web Crypto hashes B-rep bytes, response buffers transfer ownership,
and the original buffer detaches after transfer. The kernel rejects malformed
identity, graph, checkpoint, and result evidence; caps one artifact at 128 MiB;
and provides the 512 MiB aggregate guard for export orchestration. Builder,
checkpoint read, validity, write, metadata, topology, and hash faults are
atomic. OCCT handles and virtual files are cleaned, corrupt imported B-reps
remain isolated inside WASM, and cancelled or disposed browser work returns no
partial artifact.

## Checks

- `@web-cad/occt-wasm`: 109 tests passed across 2 files; typecheck passed.
- `@web-cad/geometry-kernel`: 94 tests passed; typecheck passed.
- `@web-cad/geometry-worker`: 57 tests passed; typecheck passed.
- `@web-cad/web`: 994 tests passed across 118 files; typecheck passed.
- `@web-cad/cad-core`: 1,111 tests passed across 55 files; typecheck passed.
- Focused V13-V19 release fixtures: 30 tests passed.
- Focused `.wcad` topology-checkpoint workflows: 25 tests passed.
- ESLint passed with zero errors and the six existing Fast Refresh warnings.
- Prettier and `git diff --check` passed.

Gate D is complete. Slice E may consume these artifacts in the named AP242
writer; no production writer migration, persistence change, dependency,
package, schema, or modeling-matrix expansion was included here.
