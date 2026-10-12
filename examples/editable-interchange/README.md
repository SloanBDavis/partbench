# Editable interchange proof

Run the small closer from the repository with Node.js 22 and pnpm 10 installed:

```sh
pnpm smoke:interchange
```

The consolidated E2E runner generates `authored-nested.step` from real CAD
operations, then opens the real Chromium workbench. It cancels and retries an
import, makes one nested occurrence independent, picks and offsets a face,
checks changed/unchanged body volumes, uses Undo/Redo, saves native, reloads,
reopens and edits again. An invalid STEP is the break case. Bun 1.4.2+ and
Chrome/Chromium are required. No unit tests or engine download are involved.

Fixtures and saved files live under `.metrics/editable-interchange/`; screenshots
are under `.metrics/ui-smoke/`. The source assembly has two repeated, differently
rotated modules: each has a radius 3 mm, depth 8 mm pin and two 4 × 6 × 2 mm pads.
`pnpm test` includes this journey alongside assembly controls and a public MCP
modeling journey. Older detailed codec/contract checks are historical evidence,
not claims about today's consolidated suite.

Native `.wcad` retains full Partbench source/history. STEP retains supported exact
geometry and assembly data; it does not reconstruct foreign sketches or feature
history. DXF/SVG retain the supported local 2D curves and names; exports report
omitted constraints, construction flags, attachments, and history. Unsupported
curve types are rejected rather than silently tessellated or discarded.

The supported DXF subset is planar lines, circles, arcs, and polylines, including
exact bulge arcs. SVG supports lines, circles, plain rectangles, polylines,
polygons, and circular-arc paths using `M/L/H/V/A/Z`. Unitless DXF requires a unit;
SVG viewports require consistent physical dimensions or an explicit unit.
Bezier curves, text, images, and arbitrary DXF/SVG content are outside this slice.
See the complete [format contracts](../../docs/editable-interchange.md#format-contracts).

## Small browser Use

The alias below generates its own fixture and runs the same consolidated journey:

```sh
pnpm smoke:interchange:browser
```

The recorded small journey passed in 10.3 seconds: import the nested assembly,
make one occurrence independent, pick and offset an actual face, check exact
volume and the unchanged sibling, undo/redo, save native, reload the browser,
open the saved file, and edit the saved offset parameter. File-picker fixtures
exercise the real product reader/writer; they do not automate the operating
system's file dialog. These are historical timings, not a large-engine rendering or current speed
measurement. See the
[verification record](../../docs/verification.md) for current run evidence.

## Full radial-engine acceptance

Download the pinned source recorded in
[`examples/engine-step-trial/source.json`](../engine-step-trial/source.json) to
`.metrics/engine-step-trial/radial-engine.step` and verify its size and SHA-256
against that metadata. Then run the separate headless closer from the repository:

```sh
pnpm smoke:engine-interchange
```

An optional positional argument supplies another local STEP path, although the
engine closer's assertions deliberately target the pinned radial engine. The
default full run starts with STEP bytes; the script's native-resume option is a
debugging shortcut and is not a substitute for full acceptance.

The [latest full run](./engine-evidence.json) records its environment and stage
timings. Initial import preserves 51 body definitions, 246 leaf
occurrences, and 266 placed solids. A single occurrence becomes independent,
increasing definitions to 52; its bore changes while three sibling occurrences
retain the original. A normal sketch cut and move survive native save/open.
The saved cut parameter remains editable with undo/redo. STEP export and fresh
session reimport preserve the placed geometry, then another bore edit and sketch
cut pass. The closer checks STEP placed volume within 1 mm³ and bounds within
0.001 mm. Sessions are fresh within one process.

Historical September measurements on an Apple M4, Node 22.22.1, macOS arm64:

| Measured stage                     |         Duration |
| ---------------------------------- | ---------------: |
| Cold STEP import / exact readiness | 49.75 s / 0.48 s |
| Native open / exact evaluation     |  0.89 s / 1.90 s |
| STEP export                        |          11.36 s |
| STEP reimport / exact readiness    | 48.24 s / 0.50 s |
| Individual tested edits and moves  |      0.50–0.61 s |

The script writes engine native/STEP artifacts and a report under
`.metrics/editable-interchange/`; a successful full run also updates
`engine-evidence.json` here. The source model is not redistributed. No engine
download or large-engine run is added to the default fast suite.

The separate `pnpm smoke:engine-interchange:browser` journey covers progressive
import, native orbit before exact readiness, placed geometry, camera continuity,
Fit, selection, native parity, active-worker cancellation and invalid-file handling.
Historical [`browser-evidence.json`](./browser-evidence.json) records a 59.6-second import
through readiness, 51 mesh definitions and 246 rendered occurrences, and no
new mesh uploads during orbit. Screenshots were visually inspected. The
10-second cold-view target was unmet in that September run. Current cold-view
measurements are in [import performance](../../docs/import-performance.md);
software-WebGL frame-time spikes leave the hardware frame-budget target open.
Body/occurrence RGB is retained, but the engine reports omitted
face/edge appearance or transparency on `43-Compression Spring`. Direct offsets
support straight planar neighborhoods and complete cylindrical walls with
perpendicular planar ends; unsupported neighborhoods reject atomically. STEP
export rejects non-rigid occurrence placements. These limits and the remaining
performance work are recorded in the
[current goal](../../docs/editable-interchange.md).

## Current performance work

The [2026-10-12 progressive import record](./progressive-import-evidence.json)
contains all five isolated production runs: real geometry is orbitable by
4.11–8.77 s, all 266 preview solids arrive by 10.51–14.26 s, and exact/display
readiness takes 69.62–89.23 s. Native parity, placed bounds, camera continuity,
Cancel and invalid-file handling pass in each run. These are separate viewing
and editing milestones. PERF-001 and PERF-003 are Done; PERF-002 remains Not done.

See [import and editing performance](../../docs/import-performance.md) for the
current implementation and measurements. To compare an import against a
native file produced by an older checkout without weakening geometry checks:

```sh
pnpm smoke:engine-interchange --compare-native=/absolute/path/engine-initial.wcad
```

The optional comparison checks all imported BRep bytes and topology evidence,
then continues the same complete editing/save/reopen/export/reimport workflow.
The browser engine journey also proves cancellation with an existing solid.
