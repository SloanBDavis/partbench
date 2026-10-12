# Import and editing performance

Current slice of the [CAD parity roadmap](parity-roadmap.md), updated 2026-10-12.
Binary completion is tracked in the [feature matrix](cad-feature-matrix.md#area-performance):
**PERF-001 and PERF-003 are Done** after five isolated production journeys.
Exact selection within 20 seconds (PERF-002) remains **Not done**.
The pinned 13.4 MB engine remains the acceptance fixture: 51 unique parts,
246 occurrences and 266 solids. No exact geometry is removed or approximated to
make this workflow faster.

## Progressive cold view — 2026-10-12

Import opens the 3D view immediately. Real OCCT meshes arrive in batches, fit the
viewport automatically, and accept orbit, pan and zoom while the unchanged exact
reader prepares editing data. Once the user navigates, arriving parts and the
final mesh replacement preserve that camera. An import panel explains what is
ready, shows the number of visible shapes, and exposes Cancel and Escape.
Modeling commands stay unavailable through the final display handoff. The late
confirmation dialog is removed: choosing Import starts one atomic import that
can be cancelled before commit or undone afterward. Import warnings remain visible.

The short-lived display path uses `occt-import-js@0.0.23` (7.3 MB WASM) behind
`occt-wasm`, the typed kernel facade and dedicated workers. For supported large
STEP assembly graphs, a coordinator partitions representation references without
interpreting coordinates or transforms; OCCT resolves the original placements.
Up to eight batches run through at most three native display workers, bounded by
reported CPU and memory. Smaller source batches go first; each worker reuses its
OCCT module for later batches. This reduces time to visible parts and avoids
starting a new native module for every batch.
Small files and unsupported representation layouts use an unsplit OCCT preview.
The preview uses 1 mm physical linear deflection and 0.8 rad angular deflection;
appearance is deferred to the final display. It never becomes document content,
a pick map, an editing checkpoint or a saved asset. Failure or a 30-second display
timeout falls back to the original exact import. Cancel terminates the whole
worker subtree, removes the preview and restores the previous model and camera.
Modeling previews are also tied to an active editor and the current document
revision. Current exact artifacts replace each body's earlier recipe display
and metadata sources by ID; appending both had drawn an existing body twice when
its exact artifact arrived during a cancelled import.

The original bytes still go through canonical STEP transfer, validation, healing,
topology and signatures. Final display meshes replace the preview together after
the imported definitions have display results. This separation improves viewing
latency; full exact editing readiness is measured separately and is not claimed
to meet PERF-002's 20-second budget.

The placement comparison also exposed an existing display defect: exact-body
meshes were being centered on their bounding boxes before applying occurrence
transforms. Asymmetric engine pipes moved away from their true STEP positions.
Exact meshes now retain the definition coordinate system. A derived-cache key
revision rejects the old centered display caches; BRep, topology, signatures,
assembly source and native format are unchanged. Both OCCT readers and the saved
native checkpoints independently agree on the original placed geometry.

The existing engine browser journey now checks visible GPU output, native mouse
orbit within the time budget, atomic source state, disabled modeling controls,
all 266 preview solids, placed preview/final bounds, camera continuity, native
Save As parity, active checkpoint-worker cancellation and invalid-file rejection.
It uses the same Chromium runner as the small E2E suite. License notices and the
exact upstream source/build references ship under `apps/web/public/licenses/`.

### Measured acceptance

Five consecutive isolated production journeys passed on Linux x64, Node 22.23.3,
Chromium 154 and SwiftShader, Intel Xeon Platinum 8573C, five exposed logical CPUs
with a four-CPU quota and 16 GiB container memory. Each invocation starts a new
Chromium process, fresh temporary browser profile and local Vite preview origin.
No build, static check, profiler or other geometry job overlaps the measured runs.
The timer begins before the actual Import control is clicked, after supplying the
file-picker fixture; OS file/page caches are not flushed. This is a cold browser
import benchmark, not computer startup or a WAN download benchmark.

| Run | First visible | Orbit verified | All 266 preview solids | Exact/display ready |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4.01 s | 6.30 s | 12.92 s | 80.38 s |
| 2 | 4.73 s | 8.77 s | 14.26 s | 69.62 s |
| 3 | 3.35 s | 4.81 s | 10.57 s | 75.08 s |
| 4 | 3.16 s | 4.11 s | 10.51 s | 77.41 s |
| 5 | 4.28 s | 7.07 s | 13.72 s | 89.23 s |

All five runs reach real, navigable partial geometry within 10 seconds. More
parts then arrive; all 266 are drawn by 10.51–14.26 s. The orbit timestamp includes
native mouse input and a verified yaw/pitch change on the foreground canvas.
Final placed bounds match, the user's camera is preserved, and native Save As
matches all 51 baseline BRep/topology/signature payloads byte for byte. Cancel
stops both active checkpoint workers in 142–490 ms and restores the previous
model and camera. Modeling controls are blocked during preparation;
invalid STEP still rejects without modifying the document.

The full headless workflow passes all 20 stages, including native comparisons
against `ffb2ebc` and `d9dffca`, independent occurrence/bore edits, sketch cut,
move, native reopen, Undo/Redo, STEP export/reimport and continued editing.
`pnpm verify` passes all 13 typechecks, three browser journeys and public MCP.
Changed-source ESLint has no errors and seven existing warnings. Production
build passes. No unit tests or new browser framework were added.

[Progressive import evidence](../examples/editable-interchange/progressive-import-evidence.json)
records every run, commands, build assets, limitations and development failures.
The first acceptance series stopped on a duplicate body display during
cancellation; all five final runs start after its fix. An earlier offset-input
timeout was not reproduced under profiling or in the final unprofiled full suite.
Screenshots of the first/complete preview and final scene were visually inspected.

These measurements establish the pinned-engine contract on the declared runner.
They do not establish a 10-second budget for every STEP layout or device, hardware
GPU frame performance, or exact selection within 20 seconds. Full editing data
still takes 69.62–89.23 s; the UI states this readiness distinction throughout.
The preview adds native work and does not accelerate the canonical reader. These
runs do not demonstrate faster full editing readiness than the earlier 61.68 s
observation (which also varied substantially); reducing that cost remains the
next performance task.

The measurements below this section are historical and precede progressive display.

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
