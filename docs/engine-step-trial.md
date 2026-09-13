# Engine STEP import trial

User goal: have an independent agent import a publicly available engine STEP
assembly into Partbench and inspect whether it renders correctly. Record the
actual workflow, screenshots, and obstacles before deciding on product changes.

This is an import and viewing trial, not a new modeling release. It authorizes
no new schema, modeling family, package, or production dependency.

## Method

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

## Results — 2026-09-13

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

### Findings and next work

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

The next implementation goal should be to import this unchanged engine,
preserve its component names/placements/reuse, and inspect real rendered views
and component selection with a responsive UI. Until that succeeds, do not claim
engine rendering or assembly STEP import is complete.

## Reproduction and evidence

Download the pinned URL in `examples/engine-step-trial/source.json` to
`.metrics/engine-step-trial/radial-engine.step` and verify the size/hash above.
Then run:

```sh
pnpm smoke:ui-use -- examples/engine-step-trial/trial.json
```

The scenario is outside the daily scenario suite because it is an external
model diagnostic with a known product failure. Its later viewing steps remain
unverified until import works. No automatic download or slow engine trial was
added to the fast E2E suite.

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

The only implementation change for this trial is the existing UI runner's
`importStep` file-picker interaction, documented in
[UI smoke](./skills/ui-smoke.md). Product import and rendering code are unchanged.
Changed-runner ESLint, syntax checking, and `git diff --check` passed. The engine
trial remains a recorded failure; no successful engine closer is claimed.
