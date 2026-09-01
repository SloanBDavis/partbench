# V21 Gate G Lifecycle and Storage Evidence

Recorded: **2026-08-01**  
Implementation commit: `635f331`

## Result

Exact planning and execution now remain source-bound through normal project
lifecycle changes. Primitive body topology identity includes canonical CBOR of
its kind, dimensions, and transform, so an edit invalidates only the affected
body identity and remains deterministic across JSON/WCAD key ordering. Undo and
redo restore the corresponding body identity and require a fresh plan under the
existing conservative project-history identity rule.

Successful New, `.wcad` Open, and JSON replacement cancel the active geometry
scheduler generation, clear display and exact-metadata snapshots, and resume a
fresh generation before the replacement sources reconcile. Pending old-project
exports therefore reject as cancelled or source-changed, old derived results
cannot apply, and no old body enters a new plan. Validation failures still leave
the authoritative engine source and current plan untouched.

Checkpoint payload generation now accepts the same bounded, hash-validated
checkpoint-backed exact source as display, metadata, topology, and artifacts.
The shared OCCT artifact dispatcher writes the checkpoint payload, so rebuilt
imported downstream results do not acquire a second geometry recipe.

Repeated WCAD writes remain byte-deterministic. Reopening contains source,
history, redo, and existing authoritative checkpoints, but exact readiness is
pending until current derived evidence rebuilds; rebuilding produces the same
body order, names, units, source identity, and plan semantics. Exact queries and
exports do not alter project JSON, canonical CBOR, history, redo, source hashes,
WCAD manifests, or OPFS cache ownership. JSON without authoritative imported
checkpoint bytes retains the completed structured limitation.

No exact artifact, STEP bytes, export job/generation ID, cache key, object URL,
browser handle, or private geometry identity is persisted. No dependency,
package, schema, `.wcad` version, modeling row, approval mode, or relay behavior
changed.

## Checks

- V21 planning plus V17/V19 source, migration, history, redo, and WCAD storage:
  51 tests passed across 4 cad-core files.
- Browser export lifecycle, scheduler, display/metadata invalidation, WCAD
  checkpoint, OPFS, and derived-mesh cache: 189 tests passed across 7 files.
- Geometry kernel: 99 tests passed, including checkpoint-source hash faults.
- Geometry worker: 58 tests passed.
- OCCT WASM: 110 tests passed with real B-rep/STEP fault cleanup.
- Cad-core, geometry-kernel, geometry-worker, OCCT WASM, and web typechecks
  passed.
- `git diff --check` passed.

Gate G is complete. Slice H may expose the existing exact pipeline through the
Project/File workspace and connected readiness surfaces; it may not add file
authority to agents or another approval mode.
