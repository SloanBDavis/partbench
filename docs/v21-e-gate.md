# V21 Gate E Named AP242 Evidence

Recorded: **2026-08-01**  
Implementation commits:
`c8d4ee9a7624b4dfb0ed4a0a02d717f5c48f9187`,
`236535795c03d326b60d76a6a6f8769abbea8010`

## Result

Production STEP export now consumes only ordered, identity-bound OCCT B-rep
artifacts. The geometry-kernel validates one to 256 unique body IDs, exact B-rep
lengths and SHA-256 hashes, the 128 MiB per-body and 512 MiB aggregate limits,
and a 512 MiB output ceiling before routing the request to OCCT. The writer
parses each B-rep, adds each resulting shape once to one XDE document in plan
order, transfers the document once, writes AP242 once, and returns the raw
bytes as a worker transferable.

The A1 production writer/readback probe now constructs its inputs through the
same exact-artifact builder and artifact-only writer used by the app. Real OCCT
round trips prove `mm`, `cm`, `m`, and `in`; duplicate Unicode product names;
two non-null bodies; and AP242 schema metadata. Cad-core planning supplies the
trimmed-name/body-ID fallback, while the OCCT writer retains the same fallback
defensively. Basic and named writer capability are reported separately, and
production remains unavailable without the complete named XDE binding set.

Every frozen authored and checkpoint-backed V21 exact source family now builds
a same-shape artifact and writes a non-empty AP242 file in the real-OCCT matrix,
including compound pattern/mirror shapes. Selected, explicit ordered
multi-body, duplicate-name, Unicode-name, fallback-name, and Export-all
semantics remain plan-owned and all-or-nothing.

The browser path captures and validates the plan, resolves current exact
sources, builds artifacts under cancellable export jobs, rechecks project and
per-body identities around every asynchronous boundary, transfers B-rep
buffers into the worker, validates the final STEP artifact, and rechecks the
plan immediately before creating the Blob. Artifact references are dropped on
all exits, input buffers transfer without a second copy, download URLs are
revoked in `finally`, and rejected worker work becomes a structured export
diagnostic while cancellation retains its existing generation error.

The former production feature-recipe STEP mapping and STEP base64/copy helpers
are deleted. Compatibility-only public export recipe/artifact fields remain
readable, but no supported production caller sends extrude, revolve, sweep,
profile, or source recipes to the writer. No dependency, package, project
schema, `.wcad` version, persistence field, MCP byte surface, or modeling row
was added.

## Checks

- `@web-cad/occt-wasm`: 110 tests passed across 2 files; typecheck passed.
- `@web-cad/geometry-kernel`: 97 tests passed; typecheck passed.
- `@web-cad/geometry-worker`: 57 tests passed; typecheck passed.
- `@web-cad/web`: 994 tests passed across 118 files; typecheck passed.
- Focused current-source/runtime-policy and export-orchestration suites: 12
  tests passed after the production policy simplification.
- Production web build passed, including the artifact-only export chunk and
  browser cad-core entry.
- ESLint passed with zero errors and the six existing Fast Refresh warnings.
- Prettier and `git diff --check` passed.

Gate E is complete. Slice F may consume the same current exact-result evidence
to align display, topology, metadata, mass, selection, measurement, health,
and export state; it may not add another resolver or exact-result authority.
