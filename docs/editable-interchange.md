# Editable import and export

User goal: import an engine or another supported model, edit it with the same
sketching, modeling, and assembly tools as a model created in Partbench, export
it, reopen it, and continue editing. Imports are first-class document content.
The browser and headless agent runtime share this behavior.

Status: shared STEP and sketch interchange are implemented. The unchanged public
radial engine passes the full 18-stage headless import → edit → native reopen →
STEP export/reimport → edit workflow. Cold import still takes about 50 seconds;
the 10-second target is unmet. Full-engine Chromium import, rendering, Fit,
orbit, and component selection pass; browser import through readiness takes
59.6 seconds. See [verification](./verification.md)
for the current close-loop record and the [original trial](./engine-step-trial.md)
for the failure that prompted this work.

## One document and one modeling system

Format readers decode files into ordinary Partbench document objects. A STEP
part starts with an exact BRep base feature; a created part starts with an
authored recipe. Both produce versioned exact bodies through the same evaluator.
Subsequent edits are ordinary CADOps features with the same transactions,
undo/redo, references, and export behavior. Imported curves become ordinary
sketch entities. Imported placements become ordinary assembly instances.

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
Its labels, component references, and locations map to normal cad-core IDs.
`cad-runtime` owns common import preparation, exact source resolution, and
export. Browser and Node hosts supply file access and delivery. MCP is a thin
adapter over that shared session and CADOps.

STEP preparation processes unique definitions and retains repeated occurrences,
nested assemblies, names, placements, and multi-solid part grouping. It does not
expand every placed solid into a separate body definition. A prepared import is
reused across preview/dry-run and commit; failed validation leaves the document
unchanged. Import allocates collision-safe IDs and applies its operations in one
transaction. Opening a native project instead restores that project's complete
source and history.

Exact assets and detailed topology evidence are reused by body version and
source identity. Moving occurrences changes placements without rebuilding their
unchanged definitions. A shared definition edit recomputes the affected body and
its dependents. Bounded derived caches accelerate this work; they do not replace
native exact base assets or document authority.

## Editing and compatible source extensions

Assemblies use a tagged body-or-assembly definition reference, normal transforms,
names, and optional RGB appearance. Root assemblies are definitions not referenced
by another assembly; an occurrence path identifies one repeated nested part.
Cycles and unrepresentable transforms reject before publication. Ordinary
consuming edits update assembly references to the result body, including undo
and redo, so a shared definition edit remains visible in every occurrence.

Making one occurrence independent copies its current exact body and only the
shared assembly ancestors along the selected path. `feature.copyBody` creates
an exact base feature in the existing imported-body family with
`sourceFormat: "brep"`. The transaction redirects that occurrence to its new
body; other occurrences retain the original. This source representation also
supports copying an authored exact body. It is not a standalone BRep file codec
or reconstruction of foreign design history.

Imported and authored bodies use the same planar-face sketch attachment,
extrusion add/cut, hole, and supported edge-finish paths. Plane frames, cylinder
axes, and public topology anchors derive from actual OCCT geometry. Occurrence
picking and sketch placement account for the component's world transform before
editing its definition. Eligibility depends on exact geometry and references,
not whether the source was imported.

Direct face edits are ordinary offset features with
`source.kind: "directFace"`. `feature.faceOffset` and
`feature.updateFaceOffset` expose signed distances: positive adds material;
negative removes it and enlarges an internal bore. Current exact support is:

- Planar faces in straight extrusions, with perpendicular planar neighbors or
  cylinders parallel to the moved face normal.
- Complete cylindrical walls bounded by perpendicular planar end faces,
  including walls split into matching patches at a STEP seam.

Partial/windowed cylinders, blended or incompatible neighboring surfaces,
general freeform offsets, and edits that collapse or split the target solid are
rejected by exact preflight. General delete/replace-face tools are not included.
Ambiguous topology references require repair instead of selecting another face.
The supported edits retain ordinary feature parameters and kernel history.

These are additive fields and command variants in the existing native formats;
missing optional fields preserve older projects' behavior. Native packages carry
original and copied base assets, sketches, features, assemblies, and history.

## Format contracts

A normal geometry STEP file does not carry the original application's complete
sketch constraints or feature timeline. New features can be added without
recovering that recipe. A Partbench STEP export likewise represents the current
geometry, not the source feature timeline. Native `.wcad` is the format for
continuing parameter and transaction-history edits. See
[Autodesk's explanation of imported design history](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/Imported-files-do-not-contain-timeline-features-in-Fusion-360.html).

| Implemented format | Preserved content                                                                                                                              | Explicit limits                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Native `.wcad`     | Complete Partbench source, parameters, sketches, feature recipes, assemblies, mates, references, exact base assets, and transaction history    | Open restores the complete project. This slice does not add selected-native-source merge/export.                                                |
| STEP               | Exact geometry, reusable definitions, nested occurrences, multi-solid grouping, names, rigid placements, units, body and occurrence RGB colors | No original feature history, sketch constraints, per-face/edge colors, or transparency. Non-rigid occurrence placements are rejected on export. |
| ASCII DXF          | Supported local 2D analytic sketch curves, layer names, and units                                                                              | No 3D entities, arbitrary CAD entities, foreign constraints, styles, or feature history.                                                        |
| SVG                | Supported local 2D analytic sketch curves, supported group names, and physical scale                                                           | No arbitrary artwork, text, raster images, external references, foreign constraints, or feature history.                                        |

STEP writes shared definitions and occurrences through XDE. Rotation and
translation are supported; scaled or reflected occurrence placements fail with
an actionable export error rather than changing geometry silently. Shear is not
representable in the normal assembly transform. STEP file units convert once to
document units. Round-trip checks compare placed geometry within tolerances;
internal IDs, STEP entity order, and serialized bytes need not match.

Body and occurrence RGB survive supported STEP round trips. Face/edge colors and
transparency are omitted with an appearance diagnostic. The engine specifically
reports `STEP_APPEARANCE_PARTIAL` for `43-Compression Spring`; a successful import
does not mean full source appearance survived.

DXF accepts `LINE`, `CIRCLE`, `ARC`, `LWPOLYLINE`, and planar legacy `POLYLINE`.
Polyline bulges become exact circular arcs. Unsupported entities such as
`INSERT` and splines, elevated/tilted geometry, and nonzero polyline widths reject
the import. A unitless DXF requires an explicit unit; declared supported units
or a requested override determine scale.

SVG accepts lines, circles, plain rectangles, polylines, polygons, and paths
using `M/L/H/V/A/Z` (including relative forms), with circular arcs. Supported
transforms preserve exact curves; a transform that would turn a circle into an
ellipse is rejected. Text, images, `use`, clipping, masks, filters, Bezier paths,
and geometry-changing CSS are outside this subset. An SVG `viewBox` needs
consistent physical width/height or an explicit import unit. Otherwise standard
CSS pixels use 96 pixels per inch. Import converts SVG's Y direction to the
sketch's local Y-up frame. An optional positive finite scale is applied once.

Sketch exports contain local lines, circles, arcs, and rectangle boundaries with
sketch names. They report omitted dimensions, constraints, construction flags,
attachments, and history. Unsupported geometry rejects the export; curves are
not silently tessellated or discarded. Hole-bearing profiles can be imported,
extruded, exported as curves, and imported again through ordinary sketch CADOps.

IGES, standalone BRep exchange, STL, OBJ, glTF, proprietary codecs, and automatic
recovery of unknown feature history are not implemented by this slice. Future
codecs must enter this same source model and state their fidelity limits.

## Browser and agent workflow

Browser Import accepts STEP, DXF, and SVG. Imported curves appear as normal
sketches. Project Export writes STEP assemblies or supported local sketch curves
as DXF/SVG and reports format omissions. Native save preserves the complete
editable document. Shared WebGL2 mesh rendering uses reusable buffers and
instancing for both authored and imported parts; Canvas 2D supplies the grid,
overlays, and fallback. The browser importer primes the same strict evidence
cache as the headless importer; display and metadata reuse validated topology
and measurements instead of extracting them again. Hash/signature mismatches
still fail, and callers receive isolated metadata copies.

Headless agents use `cad.project_import_file`, `cad.project_structure`, ordinary
CADOps, and `cad.project_export_file`. The occurrence projection of
`cad.project_structure` supplies root assembly IDs, instance paths, and poses.
`cad.assembly_make_independent` takes the root assembly and path for one occurrence.
Import returns created IDs and diagnostics without returning raw BRep bytes.
File access follows the workspace bounds, symlink, and size rules. Native
`cad.project_open` / `cad.project_save` remain the complete-project workflow.

STEP export accepts body or assembly selection; DXF/SVG export accepts sketch
selection. Mixed selectors reject. With no explicit STEP selection, the scene
includes root assemblies and active bodies outside assemblies.

## Verified engine result — 2026-09-13

The [recorded full engine run](../examples/editable-interchange/engine-evidence.json)
passed all 18 stages on Node 22.22.1, macOS arm64, Apple M4, with no concurrent CAD
run. It used the unchanged 13,389,913-byte radial-engine source and hash recorded
in the [historical trial](./engine-step-trial.md). Fresh sessions in this run share
one process; these are headless measurements, not browser timings.

| Stage                                                 |        Observed duration |
| ----------------------------------------------------- | -----------------------: |
| Cold STEP import                                      |                  49.75 s |
| Initial exact readiness                               |                   0.48 s |
| Make one nested occurrence independent                |                   0.52 s |
| Resize its bore / add sketch cut                      |          0.60 s / 0.58 s |
| Move that component                                   |                   0.50 s |
| Open edited native / evaluate reopened source         |          0.89 s / 1.90 s |
| Update saved cut depth, undo, redo                    | 0.51 s / 0.50 s / 0.50 s |
| Export edited STEP                                    |                  11.36 s |
| Reimport STEP / exact readiness                       |         48.24 s / 0.50 s |
| Another bore edit / another sketch cut after reimport |          0.57 s / 0.59 s |

Initial import produces 51 unique body definitions and 14 assembly definitions,
with 246 leaf occurrences containing 266 placed solids. Making one cylinder
independent increases unique bodies to 52. The bore grows from 11 to 11.1 mm;
three sibling occurrences retain the original definition. A sketch-driven oil
port and component move survive native reopen. Changing the saved cut depth
from 0.5 to 0.75 mm, undo, and redo all pass.

STEP reimport retains 52 definitions, 246 occurrences, and 266 placed solids.
The closer checks placed volume within 1 mm³ and placement bounds within
0.001 mm. It then grows the reimported bore to 11.15 mm and adds a second sketch
cut, demonstrating continued editing after the exchange round trip. Stage-end
process RSS reaches about 2.50 GiB across the multi-session run; this is sampled
memory, not a continuously measured peak or a cache heap limit.

The original targets remain: usable cold browser view within 10 seconds, full
component selection within 20 seconds, cached reopen within 2 seconds, orbit
near 60 fps, and typical one-part edits below one second. Cold import exceeds
the first target before browser display begins. Native open plus evaluation is
about 2.79 seconds in this headless run. The measured local edits meet the
one-second target here. The full-engine Chromium journey passes in 72.4 seconds,
including a 59.6-second import through readiness, Fit, native orbit, selection,
and an invalid-file break. It renders 246 occurrences from 51 mesh definitions
with 461,173 placed triangles. Orbit adds no mesh uploads. Its 54 sampled
requestAnimationFrame timestamps have median 16.7 ms and p95 116.6 ms intervals
under SwiftShader software WebGL. This is not a sustained hardware frame-rate
benchmark; the frame-time spikes leave the 60-fps target open. Cancellation
during a long import is not exercised by this journey. See the
[browser evidence](../examples/editable-interchange/browser-evidence.json).

## Small proof and reproduction

Keep the normal proof fast. `pnpm smoke:interchange` runs focused runtime and
sketch-codec tests plus the ordinary CADOps scenario. The small authored fixture
contains repeated, rotated, nested parts and a multi-solid definition. It checks
shared edits, independent copies, moves without unchanged-body rebuilds, native
history, a second STEP round trip into inch units, names/colors, and exact
hole-bearing sketch exchange. Invalid imports, dry runs, and a cyclic assembly
transaction leave the source unchanged.

`pnpm smoke:interchange:browser` runs the focused Chromium Use scenario against
those generated fixtures. Its recorded small journey passes in 10.3 seconds:
nested import, independent copy, actual face pick and offset, unchanged-sibling
volume check, undo/redo, native save, fresh browser reload/open, and a saved
offset parameter edit. File-picker fixtures exercise product file code rather
than operating-system dialogs. This does not establish large-engine rendering.

`pnpm smoke:engine-interchange` runs the separate full
headless engine acceptance after the pinned source is downloaded. Neither the
large engine nor browser work is added to every-save tests. Reproduction,
artifacts, and format limits are linked in the
[example README](../examples/editable-interchange/README.md). The
[verification record](./verification.md) distinguishes commands from actual Use.

## Historical performance baseline

Before this implementation, browser import rejected 266 solids against a
one-body limit after a long expanded-compound import. The original isolated
2026-09-13 profile ran the old reader, transfer, healing, full topology snapshot,
and BRep writer in a fresh Node 22 process on the same Apple M4.

| Original stage         | Observed duration |
| ---------------------- | ----------------: |
| Load OCCT              |            2.18 s |
| Read STEP text         |            2.75 s |
| Transfer shapes        |           12.34 s |
| Heal expanded shape    |           19.35 s |
| Full topology snapshot |          162.19 s |
| Write BRep             |            0.63 s |
| Total measured stages  |          199.44 s |

That expanded topology snapshot created 143,103 descriptors, about 81% of measured
time. The diagnostic excluded browser display, meshing, and transactions; it is
not directly comparable to a complete current session import.
[Raw stage evidence](../examples/engine-step-trial/stage-profile.json) and the
[original profiling script](../examples/engine-step-trial/profile-import.mjs)
remain available. The original browser failure and its overlapping timing caveat
are preserved in the [trial record](./engine-step-trial.md).
