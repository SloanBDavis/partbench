# Editable import and export

User goal: import an engine or another supported model, edit it with the same
sketching, modeling, and assembly tools as a model created in Partbench, export
it, reopen it, and continue editing. Imports are first-class document content.
The browser and headless agent runtime share this behavior and stay fast.

Status: implementation design, informed by the
[engine import trial](./engine-step-trial.md) and the code audit below. The trial
record is pushed; assembly import and general direct editing are not implemented
by this document.

## One document and one modeling system

Format readers decode files into ordinary Partbench document objects. A STEP
part starts with an exact BRep base feature; a created part starts with an
authored recipe. Both produce versioned exact bodies through the same evaluator.
Subsequent edits are ordinary CADOps features with the same transactions,
undo/redo, references, preview, and export behavior. Imported curves become
ordinary sketch entities. Imported placements become ordinary assembly
instances. No conversion mode or import-only modeling tools should be needed.

```text
File bytes → format decoder ─────────────┐
                                        ↓
UI / headless agent → CADOps → cad-core document and feature graph
                                        ↓
                              shared exact evaluation
                                        ↓
                           OCCT bodies and topology history
                              ↙                   ↘
                    derived viewport          native / STEP export
```

XDE is an exchange adapter inside `occt-wasm`, not another document authority.
Map its labels, component references, and locations into cad-core, then use
Partbench IDs. Raw OCCT handles and checkpoint-local identifiers remain private.
The browser and Node own file access; `cad-runtime` owns the common import
preparation and application service. MCP remains an adapter over that service
and CADOps.

## What editability and round trips mean

Editable STEP solids must support component selection, moves, shared-part edits,
independent copies, sketches on real planar faces in any orientation, add/cut,
holes, supported edge finishes, and direct geometric edits such as changing a
cylindrical bore or moving a planar face. Direct edits are saved as normal
parameterized features, including their target references and kernel history.
These operations must work equally on imported and authored bodies.

A normal geometry STEP file does not carry the original application's complete
sketch constraints or feature timeline. New features can be added to that
geometry without reconstructing its original recipe. Do not invent historical
dimensions or claim that they survived export. See
[Autodesk's explanation of imported design history](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Imported-files-do-not-contain-timeline-features-in-Fusion-360.html).

| Format | Content that must remain usable | Round-trip contract |
| --- | --- | --- |
| Native `.wcad` | Sketches, parameters, feature recipes, assemblies, mates, references, exact base assets, transaction history | Preserve the complete Partbench source model; reopen and continue parametric editing and history operations. |
| STEP | Exact geometry, component definitions and occurrences, names, placements, units, and supported appearance | Export the current model or selected assembly; reopen the same placed geometry within stated tolerances and edit again. Original foreign feature history is not synthesized. |
| IGES / BRep | Exact curves, surfaces, shells, and solids actually represented by the file | Reuse the same body/sketch/surface model and operations. Add shared entity support before claiming fidelity for types Partbench cannot yet represent. |
| DXF / SVG | Sketch curves and profiles, scale, supported layers/names | Import into the ordinary sketch model. Export supported curve geometry; preserve full constraints and recipes through `.wcad`. Report unsupported entities or approximations. |
| STL / OBJ / glTF | Mesh geometry and supported component/appearance data | Meshes share document placement, selection, and history. Smooth analytic surfaces and original sketches cannot be recovered losslessly from triangles. Reconstruction/conversion must be an explicit, recorded operation. |

The sequence starts with native and STEP, then adds other codecs to the same
service. Supporting a filename extension is not proof of editable fidelity.
Export reports describe omitted or approximated data before delivery. Never
silently discard components, sketches, units, or geometry to produce a file.
Native selection export must include the source dependencies needed to reopen
and edit that selection. Importing into an existing project must remap colliding
IDs and their references transactionally; opening a native project restores that
project's own source and history.

## Confirmed gaps in the current implementation

- `apps/web/src/App.tsx` hardcodes `maxBodyCount: 1`. Its resolver also defaults
  to one and explicitly accepts one result body per operation.
- `packages/occt-wasm/src/stepImport.ts` calls `OneShape()`, heals the expanded
  compound, extracts its full topology, and only then checks the body limit.
  One checkpoint is emitted for the entire engine.
- `AsyncCadCommandExecutor` in `packages/cad-core/src/engine.ts` resolves an
  unresolved STEP operation on each execution. The UI submits the same
  unresolved operation for dry-run and commit; the resolver has no prepared
  import cache. This can repeat costly import preparation on successful input.
- STEP preparation lives in `apps/web`; `CadSession` does not install that
  resolver. Headless native open and STEP export exist, but equivalent STEP
  import is missing from the shared session.
- The shared exact resolver already contains checkpoint-backed boolean, hole,
  and edge-finish paths. They are foundations to unify and extend, not a reason
  to build a second modeling stack. Checkpoint command proofs currently infer
  axis-aligned planar faces and linear edges from bounds; this is insufficient
  for general engine geometry. General face-edit commands are also missing.
- The STEP writer already uses XDE but accepts a flat list of body artifacts;
  it does not write the document's occurrence hierarchy. The current export
  request limit is 256 body artifacts. Raising import's count alone would not
  establish arbitrary assembly round trips.
- The viewport currently projects and draws meshes with Canvas 2D. Large-model
  drawing and picking need their own measured budget; successful STEP decoding
  alone does not establish interactive rendering.

The installed OCCT/WASM runtime exposes `STEPCAFControl_Reader_1`,
`STEPCAFControl_Writer_1`, `XCAFDoc_ShapeTool`, and `BRepTools_History`. Bundled
declarations include component enumeration, referred definitions, locations,
and adding assembly components. No new kernel dependency is needed merely to
begin implementing assembly-aware exchange. Method presence is not yet proof of
the complete engine round trip.

OCCT documents XDE's support for shape names, colors, and assembly structure in
its [exchange guide](https://occt3d.com/dev/doc/overview/html/occt_user_guides__xde.html).
Use the bundled API signatures, since that online guide documents a newer OCCT
version than the application's pinned build.

## Implementation order

An isolated stage profile on 2026-09-13 ran the existing reader, transfer,
healing, full topology extraction, and BRep writer on the unchanged engine in a
fresh Node 22 process on this Apple M4. No other CAD run was concurrent.

| Stage | Observed duration |
| --- | ---: |
| Load OCCT | 2.18 s |
| Read STEP text | 2.75 s |
| Transfer shapes | 12.34 s |
| Heal expanded shape | 19.35 s |
| Full topology snapshot | 162.19 s |
| Write BRep | 0.63 s |
| Total measured stages | 199.44 s |

Topology extraction creates 143,103 descriptors and accounts for about 81% of
the measured time. This is the measured priority, not proof that all that cost
can be eliminated. Detail inside topology extraction still needs profiling.
The diagnostic does not include browser display, mesh generation, transaction
serialization, or successful UI preview followed by commit.

[Raw stage evidence](../examples/engine-step-trial/stage-profile.json) and
[reproducible diagnostic](../examples/engine-step-trial/profile-import.mjs) are
checked in. After downloading the pinned model from the trial, run:

```sh
node examples/engine-step-trial/profile-import.mjs
```

Optional arguments select input STEP and output JSON paths. This diagnostic is
deliberately outside the default test suite; it takes several minutes on the
current implementation and does not modify product code.

Start assembly ingestion and shared evaluation performance together. Editing
and export can proceed against their agreed body/reference contracts; the
numbered slices below describe acceptance boundaries rather than requiring
performance work to wait for every editing feature.

### 1. Preserve and edit the engine through the shared runtime

Read STEP with `STEPCAFControl_Reader` and enumerate definitions, occurrences,
local placements, and subassemblies. Preserve multi-body part grouping and
repeated references; do not equate one STEP solid with one component. Units and
transforms must be applied once. Map nested assemblies into shared cad-core
structures, extending the normal assembly representation where necessary.

Prepare immutable exact assets once per file/options/kernel identity. Dry-run
shows a bounded summary; commit checks current document revision and atomically
adopts that prepared result. Allocate all IDs transactionally. Failed or
cancelled imports leave the document intact and release staged assets. Cache
ownership must outlive live document/history references and remain bounded.

Move the resolver/payload preparation into `cad-runtime`; wire browser and
headless files into the same service. Extend the existing `project.importStep`
command and structured import response rather than exposing a bypass around
CADOps. Add `cad.project_import_file` only as a thin headless file adapter to
this service; query/command semantics remain shared with the browser.

First useful outcome: open the complete engine, pick a component, move it, make
one occurrence independent, add a sketch-driven cut to that part, and undo/redo.
The unchanged instances must reuse their original exact assets and meshes.

### 2. Generalize shared editing and topology references

Make operation eligibility depend on actual body geometry and target topology,
not the part's import provenance or primitive recipe. Resolve real plane frames,
cylinders, and curves from OCCT rather than bounding-box inference. Connect
face/edge picking to the existing public topology anchors automatically.

Route sketches, booleans, holes, fillets/chamfers, and new move/offset/delete/replace
face features through the same exact body evaluator for both source origins.
Use operation history to propagate references through modifications. When a
split/merge makes a reference ambiguous, give a repairable diagnostic instead
of silently editing another face. Local component edits must transform sketch
frames and picks between occurrence space and definition space correctly.

Keep editing a shared definition and making a single occurrence independent
explicit in the document semantics. A bore edit on one cylinder must not
unexpectedly modify every repeated cylinder.

### 3. Close native and STEP round trips

Write the assembly's definitions and placed occurrences using the existing XDE
writer. Preserve names, supported appearance, units, nesting, and multi-body
parts. Avoid rebuilding identical bodies for export or expanding every instance
into a new serialized definition. Bounds/volume checks must use placed instances.

Native save carries base assets plus the full feature/sketch/assembly source and
history. Reopen in a fresh session, evaluate changed bodies, and continue editing.
STEP reopen imports a new geometric model; do not require internal IDs, STEP
entity order, or bytes to remain identical. Compare geometry and structure within
documented tolerances and perform another edit after reimport.

### 4. Make speed a shared property

- Keep OCCT work in the existing worker/scheduler system with a warm kernel and
  retained exact assets. Prove cancellation of long native calls via the existing
  worker lifecycle; an async JavaScript wrapper alone is not cancellation.
- Process each unique part once. Instance moves update transforms; editing one
  definition recomputes that definition and its actual dependents only.
- Split essential body readiness from full semantic topology/anchor evidence.
  Build detailed metadata when a feature, pick, or query needs it; cache it by
  exact body version. Do not delay the entire engine's display to enumerate and
  hash every face, wire, edge, vertex, and coedge of every occurrence.
- Validate each unique shape and repair when required. Preserve diagnostics and
  valid exact geometry; measure removal of redundant whole-assembly healing.
- Parse once for preview/commit. Use binary transfers and bounded query results,
  avoiding repeated full BRep and topology serialization across UI and MCP.
- Persist reusable native assets and derived caches so reopening does not parse
  STEP or remesh unchanged parts. Kernel/options/tolerance changes invalidate
  only incompatible caches. Caches never replace source authority.
- Measure mesh generation, tree updates, draw time, picking, and memory separately.
  Use reusable GPU mesh buffers and instancing in the shared renderer if Canvas
  2D misses the frame budget. Prefer a focused WebGL2 renderer over a prerequisite
  WebGPU rewrite; apply it equally to authored parts, imports, and sketch overlays.

Initial engineering targets for the same 13.4 MB engine on the recorded Apple M4
host: usable cold view within 10 seconds, full component selection within 20
seconds, cached reopen within 2 seconds, and normal orbit near 60 fps. Typical
single-part edits should complete in under a second without rebuilding siblings.
These are targets, not achieved performance or universal guarantees for every
model. Record cold/warm conditions, geometry counts, stage times, peak memory,
frame times, and UI response during work; revise the targets only with evidence.

Assembly ingestion/export, shared topology/editing, and shared evaluation/display
performance are suitable parallel workstreams once their body and reference
contracts agree. Integrate at each working import → edit → export slice; avoid
waiting for a collection of disconnected subsystems to finish.

## Small proof set

Keep the normal suite fast: one editable solid round trip and one small assembly
with repeated, rotated parts, nested/multi-body grouping, and an imported sketch.
Check both authored and imported targets through the same operations. Include
one invalid/cancelled import with atomic rollback, mixed-unit handling, and an
ambiguous-reference failure. Use headless checks for command semantics and one
real Chromium journey for import, picking, sketch/edit, and native reopen.

The larger release closer uses the unchanged radial-engine source from the trial:

1. Import the complete model in browser and headless sessions, matching source
   structure against an independent XDE walk and preserving every placed solid.
2. Fit/orbit/select; make one repeated cylinder independent; change a bore and
   add a sketch-based mounting feature. Verify other cylinders are unchanged.
3. Undo/redo, native save/reopen, then change an existing feature parameter.
4. Export STEP, import in a fresh process, check placement/counts/names/units and
   exact geometry tolerances, then make another direct and sketch-based edit.
5. Run the reverse direction on an authored assembly and sketch-bearing native
   project. No geometry may disappear and no imported-only edit restriction may
   be introduced. Record the performance targets alongside correctness.

Do not put the large engine in every-save tests or claim that a single rendered
compound closes this goal. The closer is a usable editing and interchange loop.

## Scope and persistence

This user goal authorizes the assembly-aware STEP reader/writer, shared runtime
file import, general topology references and direct-edit features, ordinary
sketch import/export support, and shared renderer/evaluator changes needed by
the workflow. Prefer the existing packages and schemas. If nested assemblies,
appearance, base assets, or general geometry references require durable schema
extensions, document the smallest compatible representation and migration before
changing it. Native save must remain self-contained.

Broader format coverage follows the contracts above; proprietary format codecs,
automatic recovery of an unknown original feature history, and a standalone
import renderer are not prerequisites for the engine milestone.
