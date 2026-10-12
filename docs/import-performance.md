# Import and editing performance

Current slice of the [CAD parity roadmap](parity-roadmap.md), updated 2026-10-12.
The pinned 13.4 MB engine remains the acceptance fixture: 51 unique parts,
246 occurrences and 266 solids. No geometry is removed or approximated to make
this workflow faster.

## Cold import follow-up — 2026-10-12

The first engine import now prepares independent part checkpoints with at most
two additional browser workers. Largest parts start first; results return in
source order. The pool is used only for at least eight definitions and 2 MiB of
BRep data, with a sequential fallback when fewer than three CPUs or less than 4 GiB of
reported device memory is available. All
canonical validation, repair, topology and exact signatures remain intact.
Workers are disposed after success/failure and when their parent import is cancelled.

The main thread no longer hashes the complete native document/history for each
readiness update: the engine retains the identity for its current source-authority
revision, invalidated by commit, load, Undo and Redo. CBOR writes ASCII text and
floating-point values directly into chunk buffers, retaining the existing byte
format and Unicode handling. Large assemblies publish arriving display results
at 250 ms intervals; source changes, failures and completion publish immediately.
Worker queue-count changes and unchanged ribbon measurements no longer redraw
the workbench.

Production testing also exposed an existing infinite update loop when opening a
solid editor. Grip publication depended on the changing Apply callback, which
caused another render and another publication. It now depends on Apply availability
and the actual draft data. The existing engine journey exercises box creation,
then cancels a large import while the checkpoint workers are active and checks
that both workers disappear and the existing solid survives.

### Measurements

Matched production builds, previous commit `d9dffca` and this change, use the
same pinned 13.4 MB engine, Node 22.23.3 and Chromium 154 with SwiftShader on the
same Linux x64 runner. Each starts a fresh browser; no builds, geometry runs or
static checks overlap either measurement. Five logical CPUs are exposed with a
four-CPU container quota. These are individual observations, not distributions
or hardware-GPU claims. Development-server timings are recorded separately.

| Production engine import | Before | After |
| --- | ---: | ---: |
| Import click through all exact/display results ready | 78.97 s | 61.68 s |
| Main import worker job | 59.76 s | 51.78 s |

The final observation takes 21.9% less time to readiness. Final-product runs
ranged from 57.25 to 77.33 s; an earlier build reached 48.51 s. The variation
precludes treating one percentage as a guaranteed speedup. Import, Fit, orbit and selection completed
on both builds. The baseline later froze in the box editor; the final complete
journey passes that step, native-file parity, active-worker cancellation and
invalid-file rejection. Detailed results and experimental runs are in
[`cold-load-evidence.json`](../examples/editable-interchange/cold-load-evidence.json).

The headless engine workflow passes all 20 stages, including comparison with the
previous native import and the browser-produced file. All 51 BRep, canonical
topology and signature payloads are byte-identical to baseline. The browser
journey now saves a native file through Save As and uses the same comparison
helper against the headless import. History editing, native reopen and STEP
export/reimport remain part of the headless workflow.

`pnpm verify` passes all 13 typechecks, the three consolidated browser journeys
and the public MCP workflow. Production web and nested-worker builds pass.
Build scripts now inherit Node's heap configuration instead of imposing the
896/1024 MiB caps that caused TypeScript to exhaust its heap. No unit tests or
new browser framework were added. Changed source passes ESLint, with existing
hook/fast-refresh warnings; unrelated repository-wide lint errors remain.

To exercise the bundled application with the existing browser runner:

```sh
pnpm --filter @web-cad/web build
PARTBENCH_SMOKE_UI_PRODUCTION=1 pnpm smoke:engine-interchange:browser
```

Run the headless engine journey first to generate the reference native file.
The final software-WebGL orbit has median 16.7 ms and p95 366.6 ms frame
intervals, with mesh uploads unchanged at 52. Cancellation settles in 63 ms.
The 10-second cold-view target remains unmet. Native STEP read/transfer and
exact part preparation still precede the first imported scene; progressively
placing meshes after import does not make that initial native work disappear.
The implementation remains TypeScript plus the existing C++/WASM geometry kernel.

## Earlier import and editing work — 2026-10-10

### Changes

- Reuse exact native edge bounding boxes when OCCT itself derives a face's box
  from its edges. Keep the native tolerance gap during box union. General
  curved/trimmed surfaces still use OCCT's full bounds calculation. Native
  boxes are local to one topology extraction and disposed on success/failure.
- Validate the serialized canonical BRep once, instead of validating both the
  temporary reader shape and the canonical shape. Invalid geometry still goes
  through repair, serialization and another validation before acceptance.
- Reuse verified checkpoint evidence across unchanged edits. A 64 MiB / 256-entry
  LRU owns copies and compares every BRep, topology and signature byte before
  reuse; supplied hashes alone never establish identity. Changed evidence is
  decoded and hashed again. The document and native assets remain authoritative.
- Decode native CBOR numbers through one DataView per reader. Decode text from
  a borrowed view; returned binary values still own their bytes. Existing bounds,
  UTF-8, duplicate-key and numeric validity checks remain in place.
- Expose Cancel Import while reading/preparing a STEP file. Cancel terminates
  the geometry worker, waits for the abandoned operation to settle and resumes
  the scheduler. It preserves the prior document and rendered geometry. The
  short atomic commit phase disables cancellation. A subsequent import can
  start normally without a manual worker-reset step.
- Remove the obsolete Files-panel warning that claimed the STEP reader was
  unavailable even while the Import control worked. The card describes the
  supported STEP and sketch-curve imports.

The CPU profile identified expensive repeated OCCT bounds/validation and native
payload decoding. These changes retain TypeScript and the existing C++/WASM
kernel. Language replacement was not supported by the profile.

Instrumentation of the actual engine import confirms 19,580 → 6,530 full
`BRepBndLib.AddOptimal` calls and 102 → 51 validation passes. Surface/volume
property counts are unchanged. The final isolated native diagnostic takes
53.44 s: STEP transfer consumes 15.01 s, remaining full bounds 16.48 s,
validation 5.04 s and surface properties 4.64 s. This is the kernel import only,
not a full CadSession or browser readiness measurement. Earlier instrumented
timings overlapped static checks, so only call counts are compared between those
diagnostics. The counts and final stage costs are in the performance report.

### Proof

The full engine E2E runner accepts
`--compare-native=<previous-engine-initial.wcad>`. It imports the actual STEP,
saves native, then checks every imported BRep byte and every topology descriptor,
relationship and signature against the previous import. The ordinary editing,
history, native reopen and STEP export/reimport journey continues afterward.
This comparison caught a tolerance-gap bug in the first bounds optimization;
the final code retains OCCT boxes rather than unioning expanded numeric extents.

The small default interchange browser journey uses Escape to cancel an active import, retries,
then completes independent occurrence editing, face picking, Undo/Redo and native
save/reopen. The large-engine browser journey also cancels with an existing solid
using the Cancel Import button and verifies that the project and rendered mesh identities remain unchanged.
No unit tests or separate browser framework are added.

`pnpm verify` passes all 13 workspace typechecks, three real Chromium journeys
and the public MCP mounting-plate workflow. The final Files-panel cleanup also
passes the web package typecheck. Changed source passes ESLint (six existing
React hook warnings, no errors); changed scripts and supporting files pass
Prettier. Repository-wide lint's unrelated existing errors remain documented in
[verification](verification.md).

The larger browser check exposed a runner race when importing into an already
ready project. The shared file helper now waits for the current STEP preview or
settled error before accepting readiness. It cannot mistake the prior model's
ready state for completion of the new import.

### Measurements and remaining work

The baseline and final isolated, unprofiled engine journeys ran on the same Linux x64 host,
Node 22.23.3, Intel Xeon Platinum 8573C, five exposed logical CPUs. Baseline is
`f05e74e` in a separate worktree with the same locked dependencies. These are
single observations, not latency distributions or performance guarantees.
Full stage timings and sampled memory are in
[`performance-evidence.json`](../examples/editable-interchange/performance-evidence.json).

| Operation | Before | Final after |
| --- | ---: | ---: |
| Cold engine import | 77.44 s | 83.37 s |
| Exact readiness after import | 1.27 s | 0.29 s |
| Make occurrence independent | 1.19 s | 0.32 s |
| Resize independent bore | 1.01 s | 0.53 s |
| Sketch and cut | 1.16 s | 0.34 s |
| Move component | 1.39 s | 0.25 s |
| Native reopen + exact evaluation | 5.07 s | 4.46 s |
| Edit reopened feature depth | 1.07 s | 0.39 s |
| Undo / Redo | 0.78 / 1.30 s | 0.20 / 0.21 s |
| STEP export | 22.70 s | 28.16 s |
| STEP reimport | 68.72 s | 74.46 s |

Ordinary edits now take 0.20–0.53 seconds in the final run, approximately 2–6×
faster than baseline. Cold import, export and reimport are slower in that run.
An earlier optimized iteration imported in 55.53 s, reached exact readiness in
0.19 s and reimported in 68.35 s. Both observations are disclosed in the report;
**no reliable cold-import speedup is claimed**. Further work needs repeatable
stage-level measurements on a declared reference runner.

The extra strict native comparison runs after initial save in the optimized
journey and can affect later memory samples. Final sampled process RSS is
2.41 GB before and 1.75 GB after; these are not peak-memory measurements.

Browser results are recorded separately in
the prior `d9dffca` revision of
[`browser-evidence.json`](../examples/editable-interchange/browser-evidence.json)
(the current file records the October 12 production run).
The final Chromium 154 journey passes import, Fit, orbit, selection, cancellation
with an existing solid and subsequent invalid-file rejection. Import through
exact/display readiness takes 133.65 s. It renders 51 shared definitions as 246
occurrences; orbit keeps mesh uploads at 52. The 56 software-WebGL frame samples
have median 16.7 ms and p95 733.3 ms: visible frame spikes remain. Button
cancellation settles in 59 ms; Escape cancellation in the small journey takes
33 ms. Screenshots of the engine, selected occurrence, cancellation message and
preserved solid were inspected.

There is no matched pre-change browser run on this host; the older macOS browser
record is not a speed comparison. Software-WebGL measurements do not establish
hardware-GPU frame rates.
Cold view within 10 seconds,
selection within 20 seconds, native reopen plus evaluation within 2 seconds,
and fully progressive assembly previews remain
open targets. STEP transfer and remaining general-surface bounds work still
precede the first complete imported model. The next performance slice should
measure and shorten those stages; a loading indicator does not count as a usable
model.
