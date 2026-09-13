# Engine STEP import trial — historical baseline

User goal: have an independent agent import a publicly available engine STEP
assembly into Partbench and inspect whether it renders correctly. Record the
actual workflow, screenshots, and obstacles before deciding on product changes.

This original import and viewing trial authorized no new schema, modeling
family, package, or production dependency. Its failed result below is preserved
as evidence from `9f5daa16`, not a description of the current importer.

## Implementation follow-up — 2026-09-13

The subsequent [editable interchange work](./editable-interchange.md) implements
shared assembly-aware STEP import/export and normal exact-body editing. The
[full headless engine evidence](../examples/editable-interchange/engine-evidence.json)
now passes all 18 stages: import, make one repeated occurrence independent,
resize its bore, add a sketch cut, move it, native save/reopen, update an existing
feature with undo/redo, STEP export/reimport, and another bore edit and sketch
cut. The unchanged source yields 51 body definitions, 246 leaf occurrences, and
266 placed solids; an independent copy raises definitions to 52 while preserving
the placed counts.

The isolated Apple M4 / Node 22 run records 49.75 seconds for import plus
0.48 seconds for exact readiness, 11.36 seconds for STEP export, and
48.24 seconds plus 0.50 seconds for reimport/readiness. The 10-second cold-view
target remains unmet. Body and occurrence RGB colors are supported; the engine
reports omitted face/edge colors or transparency on `43-Compression Spring`.
The separate [Chromium evidence](../examples/editable-interchange/browser-evidence.json)
now verifies full-engine rendering, Fit, native orbit, component selection, and
a responsive invalid-file failure. Import through readiness takes 59.6 seconds.
Shared WebGL2 displays 51 definitions as 246 occurrences; orbit reuses the mesh
buffers. Screenshots were visually inspected. SwiftShader frame-time spikes
leave the 60-fps target open; see [verification](./verification.md).

## Original method

- Start from refreshed `main`, `9f5daa16`.
- Give a fresh agent the import/view task without previous development history.
- Keep the downloaded model and raw evidence under ignored
  `.metrics/engine-step-trial/`; record the source and file hash here.
- Use the existing Bun/Chromium runner and the real Project → Import STEP
  command. The runner supplies the chosen local file and accepts the import
  preview confirmation, recording its text. Parsing, transaction validation,
  geometry generation, and display use the application code.
- Inspect screenshots from multiple views and select a component if import
  succeeds. A ready API result alone is not evidence of correct rendering.
- Preserve a failed import as a failure; identify which downstream viewing
  checks it prevents.

## Model and provenance

The agent selected [Sivakumar Thirumurugan's Radial Engine](https://github.com/SivakumarThirumurugan/Radial-Engine),
a complete five-cylinder radial engine assembly. The unchanged STEP AP214 file
was exported by SolidWorks 2025. It contains 53 `MANIFOLD_SOLID_BREP` definitions,
201 `NEXT_ASSEMBLY_USAGE_OCCURRENCE` records, and 3,421 `ADVANCED_FACE` definitions.
These are source record counts, not expanded placed-component counts.

- Source revision: `e7ef4673a68cfda8bdc55961d82e9dd1401c672a`.
- Size: 13,389,913 bytes.
- SHA-256: `50e2d7946e1ebed4848549798cdaefddb5c3e8fb7f4f625c06358f4a8c0aebc0`.
- [Pinned download and metadata](../examples/engine-step-trial/source.json).
- Source repository license: MIT, copyright 2026 Sivakumar Thirumurugan.

The source model and reference image remain in ignored local evidence; they are
not redistributed in this repository.

## Original results — 2026-09-13

**The engine did not import, so correct rendering is not demonstrated.** A fresh
agent clicked Project → Import STEP in real Chromium 153. After 168,747 ms the
app rejected the file with:

> STEP import produced 266 bodies, exceeding the maxBodyCount of 1.

No preview confirmation appeared. No engine body or mesh was committed. Fit,
front/top/right views, and component selection could not be reached. The runner
reported failure, exited 1, and saved a screenshot; both the trial agent and the
parent reviewed that screenshot. This was a product import rejection, not a
missing browser executable or failed file-picker fixture.

A separate direct geometry-kernel diagnostic read the same unmodified file with
the optional body limit omitted. It completed in 193,192 ms and returned one
compound containing 266 solids, 10,330 faces, 29,796 edges, and 19,522 vertices.
OCCT reported applied healing and produced a 9,889,253-byte BRep checkpoint.
This confirms that the reader can process this file; it is not browser render
evidence or proof of complete source fidelity. The expanded solid count differs
from source definitions because assembly parts are reused.

The diagnostic and browser trial overlapped on this machine. These times are
observed run durations, not isolated performance benchmarks.

A separate single-solid shaft control passed the same file import, preview,
Fit All, four views, and body-selection path. It also rejected an invalid STEP
file with the expected reader error while remaining responsive. The final
Chromium control run passed 1/1 in 5.9 seconds (2,596 ms for the valid import,
1,878 ms for rejection). Both agents inspected screenshots. The independent
report retains earlier control corrections: expanding the imported feature
before selecting its Result body, replacing an incorrect disabled-button
assumption, and fixing the runner to distinguish an expected import error from
a freeze. This control proves the test interaction and basic single-solid
rendering; it does not establish engine rendering.

### Findings at the original revision

1. **Browser import is limited to one solid.** `importProjectStepBytes` in
   `apps/web/src/App.tsx` hardcodes `maxBodyCount: 1`; the browser resolver also
   defaults to one. The OCCT importer checks expanded solid count only after
   healing and full topology extraction. This engine takes almost three minutes
   to reach a rejection that should not require that work.
2. **Assembly structure is collapsed.** `packages/occt-wasm/src/stepImport.ts`
   uses `STEPControl_Reader.OneShape()` and produces one imported-body checkpoint
   for the whole shape. Raising the UI limit alone would yield one compound, not
   independent named, reusable components. Imported assembly structure and
   component selection need a deliberate implementation.
3. **Progress is insufficient for this workload.** The agent saw `Updating`
   without an import preview or useful stage progress during the long wait.
   Profile reading, transfer, healing, topology extraction, and checkpoint
   generation separately before choosing a performance fix. UI responsiveness
   and cancellation also need explicit verification on this file.
4. **The Files page gives contradictory capability information.** The screenshot
   shows STEP import as `Unavailable` with a message that the geometry worker
   does not expose a STEP reader, while the actual reader just parsed the file
   and reported its solid count. Report current runtime capability and the
   actionable import error consistently.

These findings prompted the next goal: import this unchanged engine, preserve
its component names/placements/reuse, and inspect rendered views and component
selection with a responsive UI. The follow-up above records which checks now
pass; the original failure is not retroactively counted as rendering evidence.

## Reproduction and evidence

Download the pinned URL in `examples/engine-step-trial/source.json` to
`.metrics/engine-step-trial/radial-engine.step` and verify the size/hash above.
Then run:

```sh
pnpm smoke:ui-use -- examples/engine-step-trial/trial.json
```

The scenario is outside the daily scenario suite because it is an external
model diagnostic. At the recorded revision it failed before the viewing steps.
Rerunning it on a later revision produces new evidence; it does not reproduce
the historical implementation automatically. No automatic download or slow
engine trial was added to the fast E2E suite. Current acceptance commands are
documented in the [interchange example](../examples/editable-interchange/README.md).

Committed evidence:

- [Import/view scenario](../examples/engine-step-trial/trial.json).
- [Direct kernel diagnostic](../examples/engine-step-trial/kernel-diagnostic.json).
- [Source metadata](../examples/engine-step-trial/source.json).
- [Independent agent observations](../examples/engine-step-trial/agent-observations.md).
- [Structured browser outcomes](../examples/engine-step-trial/trial-results.json).

Local raw evidence:

- `.metrics/engine-step-trial/browser-run.log`.
- `.metrics/engine-step-trial/engine-import-failure.png`.
- `.metrics/engine-step-trial/agent-observations.md`.
- `.metrics/engine-step-trial/inspect-step.mjs` (direct kernel diagnostic).

The only implementation change during this original trial was the UI runner's
`importStep` file-picker interaction, documented in
[UI smoke](./skills/ui-smoke.md). Product import and rendering code were unchanged.
Changed-runner ESLint, syntax checking, and `git diff --check` passed. The engine
trial remains a recorded failure. Later implementation results are recorded
separately above and in the current goal.
