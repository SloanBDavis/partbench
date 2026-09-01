# V21 Gate I Release Evidence

Status: **Complete (2026-08-01).**

Gate I closes V21 with real OCCT/browser interchange proof, inherited release
compatibility, adversarial resource/fault coverage, and reconciled release
documentation. Exact-interchange and performance evidence was gathered at
`6090eb4`; subsequent changes only separated production/test typechecking,
reconciled legacy smoke assertions, removed a chooser synchronization effect,
made an equivalent Unicode assertion lint-clean, and completed documentation.

## Delivered Contract

- Cad-core deterministically plans selected, explicitly ordered, or all active
  eligible bodies and remains the product-support authority.
- One exhaustive app resolver rebuilds every completed primitive, authored,
  imported, imported-downstream, and checkpoint-backed body row.
- The existing worker/kernel/OCCT boundary builds identity-bound session-only
  B-rep artifacts whose metadata, topology, checkpoint, and signatures come
  from the same shape.
- The production writer accepts validated artifacts, preserves body order and
  authored names, applies `AP242DIS` and the document unit, and transfers bytes
  without base64.
- Browser UI owns progress, cancellation, retry, Blob/download, and cleanup.
  Agent/MCP projections expose bounded readiness metadata only and preserve the
  two V20 approval modes.

## Exact Interchange Corpus

The production browser/WASM corpus resolved 24 bodies, built 46 artifacts, and
re-imported 29 solids. The combined STEP output was 443,780 bytes. The evidence
run hash was
`18e57c627bce3b5fb57af66d6cc73bf55e993e6f9a2f4a9f335e26bc7b45e9b6`.

| Unit | Re-import scale to mm | STEP bytes | Evidence-run SHA-256 |
| --- | ---: | ---: | --- |
| mm | 1 | 56,263 | `36a5c53ae46416f5b49899491b3fa76153cbdc8dad478dcf6381907f3d273538` |
| cm | 10 | 56,263 | `1fbaea4d1f79f6d6c9687e2e52d2cc17c6f577755885573833d3bfd9a464cf20` |
| m | 1,000 | 56,233 | `23a8ab82eae37a41155cffb30eca6044167ae8bf0533d02f222da6a17a30055e` |
| in | 25.4 | 57,208 | `1e7078cd75bb981c23b6197075d36a53375008de2b8a2edfc9300be073033d53` |

Duplicate and Unicode body names, explicit body order, selected-body export,
multi-solid imported shapes, imported-downstream results, save/open rebuild,
edit/undo/redo, and worker restart all passed exact invariant checks. STEP file
headers contain a generation timestamp, so hashes above identify this evidence
run rather than immutable fixture bytes.

Checkpoint-backed evidence covered 6 bodies and 209,204 STEP bytes with run
hash `46395c868fb1195fb317f66952894039761f78133eeef8b4d64611f60a2343b8`.
The bounded near-limit run covered 16 bodies, 66,824 aggregate B-rep bytes, and
304,625 STEP bytes with run hash
`5031b4bee3ba8ac82475fc8066c9ddc4fb5454c7d109fe5b622a65f23a9afe90`.

## Performance, Limits, and Bundles

The V21 performance gate passed in Headless Chrome 151:

| Measure | Result |
| --- | ---: |
| Next-frame feedback | 5.9 ms |
| Export main-thread long tasks | 0 |
| Production base64 conversions | 0 |
| Retained artifact buffers after cleanup | 0 |
| Artifact build p50 / p95 / max | 50.4 / 1,052.3 / 1,443.9 ms |
| STEP writer p50 / p95 / max | 86.6 / 459.1 / 459.1 ms |
| Total export p50 / p95 / max | 1,298.2 / 15,310.3 / 15,310.3 ms |
| STEP size p50 / p95 / max | 57,208 / 443,780 / 443,780 bytes |
| Worker restart | 5,659.8 ms |

The release enforces 256 selected bodies, 4,096 resolver nodes, 128 MiB per
B-rep, 512 MiB aggregate B-rep, and 512 MiB STEP output. Hash mismatch and
corrupt STEP faults returned structured `INVALID_DIMENSIONS` and
`KERNEL_FAILURE` results without partial output or retained state.

| Production asset | Raw bytes | Gzip bytes | Gate |
| --- | ---: | ---: | ---: |
| Critical UI JavaScript | 1,729,016 | 408,357 | 409,600 gzip |
| Critical CSS | 37,839 | 6,709 | 20,480 gzip |
| All UI JavaScript | 2,274,423 | 556,389 | 563,200 gzip |
| Command worker | 1,214,032 | 260,911 | 262,144 gzip |
| Geometry worker | 397,039 | 91,682 | 122,880 gzip |
| OCCT WASM | 50,305,130 | 13,808,536 | 14,500,000 gzip |

OCCT WASM Brotli size was 11,193,695 bytes. The exact-result UI/runtime and
exact source builder remain lazy production chunks; normal shell startup does
not instantiate OCCT or exact artifacts.

## Release and Compatibility Proof

All eight named V21 commands passed:

```sh
pnpm smoke:v21-exact-artifact-workflow
pnpm smoke:v21-step-export-matrix
pnpm smoke:v21-step-roundtrip-workflow
pnpm smoke:v21-storage-rebuild-workflow
pnpm smoke:v21-browser-workflow
pnpm smoke:v21-performance
pnpm check:v21-bundle
pnpm smoke:v21-release-samples
```

The final composite release-sample run passed 170 exact-artifact tests, 209
STEP-matrix tests, 4 real STEP round trips, and 172 storage/rebuild tests. V17
release/browser/storage workflows, all eight V19 release commands, all three
V20 release commands, and the V19/V20 bundle and performance gates also passed.

Repository-wide `pnpm test` passed 2,938 tests with one intentionally skipped
script test. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and
`pnpm build` passed. Lint retains six pre-existing Fast Refresh warnings and no
errors; Vite retains its large-chunk advisory, while every measured asset stays
within its binding release cap.

## Audit and Known Boundaries

The source-kind audit found no unclassified completed body and no production
base64 or feature-recipe dependency in the browser STEP path. Deprecated recipe
fields remain readable only for protocol compatibility. No V21 non-goal is
partially exposed.

V21 deliberately does not preserve editable feature history, sketches,
Partbench body IDs, or stable topology IDs through STEP. Exact artifacts rebuild
per browser session; JSON does not carry checkpoint bytes, while `.wcad` keeps
the existing explicit checkpoint payloads. The representative real-browser
near-limit workload uses 16 bodies even though the validated protocol cap is
256. Assemblies, drawings, direct edit, new modeling rows, additional formats,
agent file authority, hosted transport, and additional approval modes remain
out of scope.
