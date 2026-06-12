# Native Project Format

This document describes Partbench's current source-of-truth project format and
the direction for the future native package format. Project schema V1 is the
original JSON source-of-truth interchange format. Project schema V2 added
source-of-truth sketches, schema V3 added the first authored sketch-driven
feature data, schema V4 added source-of-truth sketch attachment metadata for
sketches created on generated planar face references, schema V5 added
source-of-truth user/agent names for generated references, schema V6 added
explicit authored extrude operation mode, and schema V7 added source-of-truth
document parameters and driving sketch dimensions. Schema V8 added
source-of-truth sketch constraint records for the first horizontal/vertical
line orientation slice. Schema V9 added source-of-truth fixed point constraints
with durable sketch point targets. Schema V10 added source-of-truth coincident
point constraints using the same durable sketch point target model. Schema V11
added source-of-truth midpoint constraints tying a point/center target to a line
midpoint. Schema V12 added source-of-truth parallel line constraints. Schema
V13 added source-of-truth perpendicular line constraints. Schema V14 added the
first authored non-extrude feature source records for `feature.revolve`.
Schema V15 added source-of-truth circular hole feature records for
`feature.hole`. Schema V16 added command-first source-of-truth edge-finishing
feature records for `feature.chamfer` and `feature.fillet`. Current exports use
`web-cad.project.v16` while the loader still accepts V1 through V15 projects
through explicit migration. The
`web-cad.project.*` names are retained as compatibility schema
identifiers after the Partbench product rename; changing them would require a
deliberate project-format migration. V8 now scopes the first native package
release in `docs/v8.md`: `.wcad` package v1, File System Access local workflow,
OPFS-derived cache, and exact STEP export for supported bodies. This document
continues to define the project-format and source/derived rules that V8 storage
work must preserve.

## Current Format

The current saved format is deliberate JSON:

```text
schemaVersion: web-cad.project.v1
schemaVersion: web-cad.project.v2
schemaVersion: web-cad.project.v3
schemaVersion: web-cad.project.v4
schemaVersion: web-cad.project.v5
schemaVersion: web-cad.project.v6
schemaVersion: web-cad.project.v7
schemaVersion: web-cad.project.v8
schemaVersion: web-cad.project.v9
schemaVersion: web-cad.project.v10
schemaVersion: web-cad.project.v11
schemaVersion: web-cad.project.v12
schemaVersion: web-cad.project.v13
schemaVersion: web-cad.project.v14
schemaVersion: web-cad.project.v15
schemaVersion: web-cad.project.v16
```

It is produced by:

```ts
exportCadProjectJson(engine)
```

and loaded by:

```ts
parseCadProjectJson(json)
importCadProjectJson(json)
```

The web app Project panel uses this same format for the current JSON save/load
flow. It can generate/download current project JSON, load JSON into an import
preview, and show current source truth, draft source, schema/version, migration
status, object count, transaction count, redo count, replacement impact,
same-document-source detection, and structured validation issues before import.
The preview uses the same importability checks as load, including transaction
replay, so malformed history is blocked before the user imports it. JSON remains
available as an explicit interchange/debug path.
In V8 Tranche C, the Project panel makes `.wcad` the primary app-level project
workflow. It reports local storage capability status, calls File System Access
open/save/save-as picker APIs only from user gestures when available, and falls
back to `.wcad` upload/download when direct handles are unavailable or denied.
File handles remain app-only browser permission state and are not written into
project JSON, `.wcad`, cad-core, agents, or MCP. OPFS, thumbnails, cache storage,
and STEP export remain deferred.
In V7 Tranche E1, `project.exportReadiness` reports STEP and Mesh/GLB
visualization readiness from authoritative project structure before any file
writer exists. It distinguishes empty projects, active authored bodies,
consumed bodies, primitive compatibility bodies, and deferred result bodies with
structured diagnostics. This readiness/status output is query-derived, is not an
export job, does not produce STEP or GLB files, and is not written into project
JSON.
In V7 Tranche E2, the web app can produce `partbench-visualization.glb` as a
transient visualization artifact from existing ready derived display meshes for
the supported active rectangle/circle `newBody` extrude subset. The GLB artifact
is display output only: it is not source authority, is not stored in project
JSON, does not create a persisted export job, and does not require
`web-cad.project.v17`. STEP remains unavailable until an exact exchange writer
binding exists.
In V7 Tranche G1, `packages/cad-core/src/releaseSamples.ts` adds deterministic
release acceptance fixtures as typed CADOps batches plus expected query
metadata. Those fixtures are built into projects by executing existing CADOps
batches, then using the current import/export path. They do not store static
project JSON, derived meshes, exact metadata, topology caches, browser storage
state, app-derived GLB artifacts, renderer IDs, OCCT IDs, cache IDs, or
selection-buffer IDs as source truth, and therefore do not require
`web-cad.project.v17`.
In V7 Tranche G2, `pnpm smoke:v7-release-samples` exercises those fixtures
through the same current project JSON import/export path and verifies that the
accepted release samples still emit `web-cad.project.v16`, not
`web-cad.project.v17`. The smoke is stdout-only by default and does not write
sample projects, metrics, derived meshes, topology caches, export artifacts, or
browser storage state into source truth.
In V7 Tranche G3, `pnpm smoke:v7-browser-workflow` exercises the built web app
through a deterministic browser workflow using the same project JSON and
CADOps/query surfaces. It does not write screenshots, metrics, project JSON,
derived meshes, topology caches, selection state, or export artifacts into
source truth and does not require `web-cad.project.v17`.
In V7 Tranche G4, the same fixture catalog expands to cover existing V6 feature
breadth used by the V7 release acceptance suite: authored `newBody` extrude,
authored `newBody` revolve, authored hole result bodies, and edge-finished
chamfer/fillet workflows. These fixtures still store only source CADOps and
expected query metadata. Revolve, hole, chamfer, and fillet result bodies remain
diagnostic for semantic generated references and export readiness; their exact
stable result topology is not persisted and does not require
`web-cad.project.v17`.

The current exported JSON shape is:

```ts
ProjectV16 {
  schemaVersion: "web-cad.project.v16"
  document: {
    units: "mm" | "cm" | "m" | "in"
    objects: SceneObject[]
    sketches: Sketch[]
    features: Feature[]
    namedReferences: NamedGeneratedReference[]
    parameters: CadParameter[]
    sketchDimensions: SketchDimension[]
    sketchConstraints: SketchConstraint[]
    nextObjectNumber: number
    nextSketchNumber: number
    nextSketchEntityNumber: number
    nextFeatureNumber: number
    nextBodyNumber: number
    nextParameterNumber: number
    nextSketchDimensionNumber: number
    nextSketchConstraintNumber: number
  }
  history: Transaction[]
  redoStack: Transaction[]
}
```

Named generated references are source-of-truth user/agent metadata:

```ts
NamedGeneratedReference {
  name: string
  bodyId: string
  stableId: string
  kind: "body" | "face" | "edge" | "vertex"
}
```

They store a human-readable name and the generated reference target that
resolved at creation time. They do not persist B-rep topology, OCCT IDs, mesh
indices, or renderer state. If the source feature is later deleted or changed
so the target can no longer resolve, the named reference remains loadable but
queries report it as stale until it is deleted or the target becomes resolvable
again through undo/redo or later edits.

Transactions may include optional actor metadata:

```ts
Transaction {
  id: string
  status: "committed" | "undone"
  actor?: {
    type: "human" | "agent" | "script" | "system"
    id?: string
    name?: string
  }
  audit?: {
    source?: string
    requestId?: string
    toolName?: string
    intent: "commit"
    operationCount: number
  }
  ops: CadOp[]
  diff: SemanticDiff
}
```

The actor records where the committed mutation came from. It is audit metadata,
not an authorization system.

The optional audit record captures adapter/request context for committed
transactions: source, request ID, tool name, commit intent, and operation count.
It is deterministic transaction metadata for traceability, not a permission or
authentication system.

Unit-change semantic diffs record the old unit, new unit, update mode, and net
numeric scale applied in that transaction:

```ts
SemanticDiff.document.units {
  before: "mm" | "cm" | "m" | "in"
  after: "mm" | "cm" | "m" | "in"
  mode: "metadataOnly" | "preservePhysicalSize"
  scaleFactor: number
}
```

Current scene objects are:

```ts
BoxObject {
  id: string
  kind: "box"
  name?: string
  dimensions: {
    width: number
    height: number
    depth: number
  }
  transform: Transform
}

CylinderObject {
  id: string
  kind: "cylinder"
  name?: string
  dimensions: {
    radius: number
    height: number
  }
  transform: Transform
}

SphereObject {
  id: string
  kind: "sphere"
  name?: string
  dimensions: {
    radius: number
  }
  transform: Transform
}

ConeObject {
  id: string
  kind: "cone"
  name?: string
  dimensions: {
    radius: number
    height: number
  }
  transform: Transform
}

TorusObject {
  id: string
  kind: "torus"
  name?: string
  dimensions: {
    majorRadius: number
    minorRadius: number
  }
  transform: Transform
}

Transform {
  translation: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}
```

Numbers in dimensions must be positive and finite. Torus `minorRadius` must be
smaller than `majorRadius`. Transform vectors must have exactly three finite
numbers. Object names are optional, but if present they must be non-empty after
trimming. Duplicate object names are allowed for now.

Document units are explicit but still simple. `document.updateUnits` supports
two modes:

- `metadataOnly`: changes `document.units` while leaving existing numeric
  dimensions and transform translations unchanged.
- `preservePhysicalSize`: changes `document.units` and scales current
  box/cylinder/sphere/cone/torus dimensions plus transform translations so
  physical size is preserved.

The project file stores the resulting authoritative document values and the
transaction diff that explains how the unit change happened.

Current sketches are source-of-truth V2 document data:

```ts
Sketch {
  id: string
  name: string
  plane: "XY" | "XZ" | "YZ"
  attachment?: SketchGeneratedFaceAttachment
  entities: SketchEntity[]
}

SketchGeneratedFaceAttachment {
  kind: "generatedFace"
  bodyId: string
  faceStableId: string
  sourceFeatureId: string
  sourceSketchId: string
  sourceSketchEntityId: string
  faceRole:
    | "startCap"
    | "endCap"
    | "side:uMin"
    | "side:uMax"
    | "side:vMin"
    | "side:vMax"
}

SketchEntity =
  | { id: string; kind: "point"; point: [number, number] }
  | { id: string; kind: "line"; start: [number, number]; end: [number, number] }
  | {
      id: string
      kind: "rectangle"
      center: [number, number]
      width: number
      height: number
    }
  | {
      id: string
      kind: "circle"
      center: [number, number]
      radius: number
    }
```

Sketch names must be non-empty after trimming. Sketch coordinates must be
finite numbers. Rectangle width/height and circle radius must be positive finite
numbers. Sketches created with `sketch.createOnFace` may store attachment
metadata pointing at an eligible generated planar face reference from an
authored sketch-extrude body. That attachment is source-of-truth sketch
placement metadata. The generated reference objects themselves remain derived
and are not persisted. Sketches do not yet include a general solver, source-level
coordinate remapping for attached faces, or automatic profile recognition. The
viewport and derived geometry pipeline may derive a frame from the current
generated face reference so attached sketches render on the referenced face and
existing `feature.extrude` bodies sourced from those sketches can be displayed
from that face. Those frames and meshes are rebuildable view/cache data and are
not saved.

Document parameters, sketch dimensions, and sketch constraints are
source-of-truth V13 document data:

```ts
CadParameter {
  id: string
  name: string
  value: number
  description?: string
}

SketchDimension {
  id: string
  name: string
  sketchId: string
  entityId: string
  target:
    | {
        entityKind: "rectangle"
        role: "width" | "height"
      }
    | {
        entityKind: "circle"
        role: "radius"
      }
    | {
        entityKind: "line"
        role: "length"
      }
  valueSource:
    | {
        type: "literal"
        value: number
      }
    | {
        type: "parameter"
        parameterId: string
      }
}

SketchConstraint {
  id: string
  name: string
  sketchId: string
  entityId: string
  kind: "horizontal" | "vertical"
}

FixedSketchConstraint {
  id: string
  name: string
  sketchId: string
  entityId: string
  kind: "fixed"
  target: {
    entityId: string
    role: "position" | "start" | "end" | "center"
  }
  coordinate: [number, number]
}

CoincidentSketchConstraint {
  id: string
  name: string
  sketchId: string
  entityId: string
  kind: "coincident"
  primaryTarget: {
    entityId: string
    role: "position" | "start" | "end" | "center"
  }
  secondaryTarget: {
    entityId: string
    role: "position" | "start" | "end" | "center"
  }
}

MidpointSketchConstraint {
  id: string
  name: string
  sketchId: string
  entityId: string
  kind: "midpoint"
  lineEntityId: string
  target: {
    entityId: string
    role: "position" | "center"
  }
}

ParallelSketchConstraint {
  id: string
  name: string
  sketchId: string
  entityId: string // matches secondaryLineEntityId
  kind: "parallel"
  primaryLineEntityId: string
  secondaryLineEntityId: string
}

PerpendicularSketchConstraint {
  id: string
  name: string
  sketchId: string
  entityId: string // matches secondaryLineEntityId
  kind: "perpendicular"
  primaryLineEntityId: string
  secondaryLineEntityId: string
}
```

Parameter names and sketch dimension names must be non-empty after trimming.
Parameter values must be finite. Rectangle width, rectangle height, circle
radius, and line length dimensions must resolve to positive finite values. A
parameter-bound dimension stores the parameter ID and evaluates through the
current parameter value. Deleting a parameter that is still referenced by a
sketch dimension fails with a structured validation error. Direct dimension
evaluation updates the target sketch entity deterministically through CADOps:
rectangle and circle dimensions rewrite their numeric fields, while a line
length dimension preserves the current line direction when no point constraint
anchors either endpoint. If one endpoint is fixed or coincident, the anchored
endpoint stays put and the other endpoint moves along the current or
orientation-constrained direction. If both endpoints are anchored and the
requested length disagrees with the anchored distance, `sketch.evaluation`
reports an inconsistent constraint rather than persisting misleading solved
geometry. A line length dimension cannot drive a zero-length line because the
direction is ambiguous. This is not a general sketch solver, expression system,
or constraint graph.

Sketch constraints are separate from numeric dimensions. The V8 constraint slice
supports line horizontal and line vertical orientation constraints. Creating one
preserves the line midpoint and current length, then sets both endpoints to the
same Y for horizontal or the same X for vertical. The V9 constraint slice adds
fixed point constraints for explicit point targets: point position, line start,
line end, rectangle center, and circle center. Fixed constraints store their
durable target and fixed coordinate as source-of-truth metadata. Duplicate
orientation constraints on the same line, conflicting horizontal and vertical
constraints on the same non-zero line, duplicate fixed constraints on the same
point target, unsupported roles, missing targets, non-finite coordinates, and
zero-length orientation targets fail with structured validation errors. This
persists authored intent only; no solved graph output is saved.

The V4 Phase C evaluator handles the first supported combinations of line
length, fixed/coincident line endpoints, horizontal/vertical line orientation,
rectangle width/height, circle radius, fixed/coincident rectangle or circle
centers, midpoint-driven centers, and parallel/perpendicular line pairs.
Unsupported or conflicting combinations remain represented as
structured evaluator issues instead of becoming saved geometry.

The V10 constraint slice adds coincident point constraints between two explicit
sketch point targets. Supported targets are point position, line start, line end,
rectangle center, and circle center. The current deterministic evaluator is
deliberately narrow: if one target is fixed, the other target moves to that
fixed coordinate; if neither target is fixed, the secondary target moves to the
primary target coordinate; if both targets are fixed to different coordinates,
the command or evaluation reports an inconsistent constraint. This is still not
a general geometric constraint solver.

The V11 constraint slice adds midpoint constraints. A midpoint constraint stores
the source line entity ID and a point/center target. Supported targets are point
position, rectangle center, and circle center; the target may not be either
endpoint of the same line. The evaluator computes the current midpoint of the
line and moves the target point/center there. Zero-length lines are valid for
midpoint constraints because the midpoint is defined. A target fixed to a
different coordinate is reported as inconsistent.

The V12 constraint slice adds parallel line constraints. A parallel constraint
stores a primary line entity ID and a secondary line entity ID. The primary line
is the reference; the evaluator keeps the secondary line midpoint and length,
then updates the secondary direction to match the primary direction. Zero-length
primary or secondary lines are invalid because the direction is ambiguous.
Fixed/coincident endpoint anchors or orientation constraints that cannot be
satisfied are reported as structured inconsistent/unsupported status instead of
silently writing misleading geometry.

The V13 constraint slice adds perpendicular line constraints. A perpendicular
constraint stores the same durable primary-line and secondary-line target pair
as parallel constraints. The primary line is the reference; the evaluator keeps
the secondary line midpoint and length, then updates the secondary direction to
90 degrees from the primary line. Zero-length primary or secondary lines are
invalid because the direction is ambiguous. Fixed/coincident endpoint anchors,
orientation constraints, line-length constraints, midpoint constraints, and
parallel constraints that cannot be satisfied are reported structurally instead
of silently writing misleading geometry.

The `sketch.evaluation` query is derived from these persisted parameter,
dimension, constraint, and sketch records. It reports current evaluator status,
driven dimension entries, constraint entries, effective values, driven entity
IDs, and structured issues, but none of that query output is saved in the
project file.

Current authored features are source-of-truth document data:

```ts
ExtrudeFeature {
  id: string
  kind: "extrude"
  name?: string
  sketchId: string
  entityId: string
  profileKind: "rectangle" | "circle"
  depth: number
  side: "positive" | "negative" | "symmetric"
  operationMode?: "newBody" | "add" | "cut"
  targetBodyId?: string
  bodyId: string
}

RevolveFeature {
  id: string
  kind: "revolve"
  name?: string
  sketchId: string
  entityId: string
  profileKind: "rectangle" | "circle"
  axis: {
    type: "sketchLine"
    sketchId: string
    entityId: string
  }
  angleDegrees: number
  operationMode?: "newBody" | "add" | "cut"
  targetBodyId?: string
  bodyId: string
}

HoleFeature {
  id: string
  kind: "hole"
  name?: string
  targetBodyId: string
  sketchId: string
  circleEntityId: string
  depthMode: "blind" | "throughAll"
  depth?: number
  direction: "positive" | "negative"
  bodyId: string
}

ChamferFeature {
  id: string
  kind: "chamfer"
  name?: string
  targetBodyId: string
  edgeStableId?: string
  namedReference?: string
  distance: number
  bodyId: string
}

FilletFeature {
  id: string
  kind: "fillet"
  name?: string
  targetBodyId: string
  edgeStableId?: string
  namedReference?: string
  radius: number
  bodyId: string
}
```

Extrude features reference an existing rectangle or circle sketch entity. The
saved feature record is the rebuild input. The body mesh produced from it is
derived cache data and is not saved in the project JSON. Feature IDs and body
IDs must be unique within their respective authored/derived ID spaces. Extrude
depth must be positive and finite. Extrude side can be `positive`, `negative`,
or `symmetric` relative to the sketch-plane normal. Extrude operation mode
defaults to `newBody` when omitted, and current exports include an explicit
`operationMode` for authored extrudes. `newBody` records must not include
`targetBodyId`. Boolean operation modes are supported only for narrow
source-modeled slices. `cut` supports a rectangle sketch-extrude tool cutting
one active authored rectangle or circle `newBody` target body. `add` supports a
rectangle sketch-extrude tool fusing with one active authored rectangle
`newBody` target body in the authoritative command model. Boolean records
require an existing authored `targetBodyId` and reject primitive-derived,
consumed, circle-tool, circle-target add, or otherwise unsupported targets.
Boolean result bodies for the supported add/cut slices are rebuilt as derived
geometry through the OCCT geometry-worker path where the app/runtime has that
path enabled. Exact B-rep checkpoints and generated topology maps are not
persisted. This slice does not include a sketch solver, arbitrary profile
recognition, broad topology mutation features, general boolean join, broad
feature edit commands, or exact B-rep checkpoint persistence.
Authored
sketch-extrude features can be removed with `feature.delete` and can have depth
and side updated with `feature.updateExtrude`. Missing side values in older
compatible project data normalize to `positive`; missing operation mode values
normalize to `newBody`.
Revolve features reference an existing rectangle or circle sketch entity plus a
non-zero line entity in the same sketch as the revolve axis. V14 stores this as
feature intent only: no B-rep, mesh, OCCT topology ID, or renderer cache is
persisted. Current command support is `operationMode: "newBody"` only, with
positive finite `angleDegrees` less than or equal to 360. Add/cut revolve modes
are reserved in the typed shape but rejected until deliberately implemented.
Revolve result bodies appear in project structure and health. App rendering can
rebuild revolve bodies as derived mesh/cache data through the geometry-worker
path, and matching derived exact metadata snapshots can provide topology
measurement confidence and project extents. Generated semantic references and
source-analytic measurements for revolve result bodies are not implemented yet.
Hole features reference a circle sketch entity on either a base-plane sketch or
an attached sketch whose generated planar face still resolves. V15 stores this
as source intent only: no B-rep, mesh result, OCCT topology ID, or renderer
cache is persisted. `feature.hole` consumes one active authored target body and
creates one authored result body, matching the add/cut result-body model. Blind
holes require a positive finite `depth`; through-all holes must omit `depth`.
The current V6 Phase D slices validate and round-trip the source model and can
rebuild supported hole result meshes as derived geometry through the
geometry-worker path. Supported hole result bodies can also report
kernel-derived exact metadata through read-only derived snapshots when the
target rectangle/circle authored extrude source and circular tool placement are
available. Generated references for hole result bodies and exact topology
naming are not implemented yet.
Chamfer and fillet features reference one generated edge on an active authored
rectangle or circle `newBody` extrude target body. V16 stores these records as
source intent only: no B-rep, mesh result, OCCT topology ID, renderer cache, or
generated references for the chamfer/fillet result body are persisted.
`feature.chamfer` stores `distance`; `feature.fillet` stores `radius`. Both
commands require exactly one reference path, either `edgeStableId` or
`namedReference`, and the reference must resolve to an operation-eligible
generated edge on `targetBodyId`. Both consume the target body and create a new
authored result body. Primitive-derived targets, boolean result bodies, revolve
bodies, hole bodies, already-consumed targets, non-edge references, stale named
references, and non-positive or non-finite scalars are rejected. Geometry-worker
execution can now rebuild supported rectangle-edge chamfer/fillet result meshes
as derived geometry through `geometry.edgeFinish`, including named references
when the app can resolve the name to a current generated edge snapshot on the
target body. Supported rectangle-edge chamfer/fillet result bodies can also
report kernel-derived exact metadata/topology status through read-only derived
snapshots. Circle target edge finishing, exact topology naming, and stable
generated references for chamfer/fillet result bodies are not implemented in
this V16 slice.
Rectangle and circle source profile values can be edited through
`sketch.updateEntity`; the feature keeps referencing the same sketch entity and
the generated body is rebuilt as derived geometry. Primitive-derived
compatibility features are not deletable through `feature.delete` or editable
through `feature.updateExtrude`.

## Project Schema V2/V3/V4/V5/V6/V7/V8/V9/V10/V11/V12/V13/V14/V15/V16 Storage Decision

The derived V2 part/feature/body bridge did not require a format change because
it is rebuilt from scene objects. Sketches are different: they are authored CAD
source data that cannot be reconstructed from V1 objects and transaction history
unless their commands remain in history forever. That introduced
`web-cad.project.v2`.

The first sketch-driven feature operation, `feature.extrude`, is also authored
CAD source data. It cannot be represented faithfully by only primitive objects
and sketches, so it introduced `web-cad.project.v3`. Current exports therefore
used `web-cad.project.v3` at that point.

The first reference-consuming command, `sketch.createOnFace`, adds authored
sketch attachment metadata. The attachment records the body ID, generated face
stable ID, source feature/sketch/entity IDs, and face role that the sketch was
created on. That data is not derivable from a plain plane sketch, so it
introduced `web-cad.project.v4`.

Named generated references are also authored source-of-truth metadata. They are
not derivable from generated labels because labels are deterministic system
metadata, while named references are chosen by a user, script, or agent. This
introduced `web-cad.project.v5`.

Extrude operation mode is also authored source-of-truth feature intent. It
distinguishes standalone `newBody` features from boolean-backed feature intent
that needs a target body. That persisted intent introduced
`web-cad.project.v6`.

Parameters and sketch dimensions are authored source-of-truth V3 data. They
cannot be reconstructed from sketch entity scalar fields alone because they carry
stable IDs, names, optional descriptions, target roles, literal values, and
parameter bindings. That persisted intent introduced `web-cad.project.v7`.

Sketch constraints are authored source-of-truth data too. The first supported
constraint records line horizontal and vertical orientation intent. That intent
cannot be reconstructed from the line endpoints alone because an already
horizontal line may or may not be constrained. That persisted intent introduced
`web-cad.project.v8`. V4 fixed point constraints add durable point targets and
fixed coordinates that cannot be represented by the V8 orientation-only shape.
That persisted intent introduced `web-cad.project.v9`. V4 coincident point
constraints add two durable point targets to one source record and cannot be
represented by the V9 fixed-target shape. That persisted intent introduced
`web-cad.project.v10`. V4 midpoint constraints add one durable line target and
one point/center target to one source record and cannot be represented by the
V10 coincident-target shape. That persisted intent introduced
`web-cad.project.v11`. V4 parallel line constraints add a durable primary-line
target and secondary-line target to one source record and cannot be represented
by the V11 midpoint shape. That persisted intent introduced
`web-cad.project.v12`. V4 perpendicular line constraints use the same durable
line-pair source shape but carry distinct relationship intent that cannot be
represented by V12 without changing meaning. That persisted intent introduced
`web-cad.project.v13`.

Authored revolve feature records carry a profile reference, a same-sketch axis
line reference, angle, body ID, and operation mode. That source intent cannot be
represented by the V13 extrude-only feature shape, so it introduced
`web-cad.project.v14`. Authored hole feature records carry target body ID,
source sketch/circle IDs, depth mode/depth, direction, and result body ID. That
target-consuming source intent cannot be represented by the V14
extrude/revolve feature shape, so it introduced `web-cad.project.v15`. Current
command-first chamfer/fillet feature records carry target body ID, one
generated or named edge reference, distance/radius, and result body ID. That
edge-finishing source intent cannot be represented by the V15
extrude/revolve/hole feature shape, so it introduced `web-cad.project.v16`.
Current exports therefore use `web-cad.project.v16`.

The loader accepts:

```text
web-cad.project.v1
web-cad.project.v2
web-cad.project.v3
web-cad.project.v4
web-cad.project.v5
web-cad.project.v6
web-cad.project.v7
web-cad.project.v8
web-cad.project.v9
web-cad.project.v10
web-cad.project.v11
web-cad.project.v12
web-cad.project.v13
web-cad.project.v14
web-cad.project.v15
web-cad.project.v16
```

Schema V1 projects migrate into the current in-memory model with unchanged units,
objects, object counters, history, and redo history, plus empty sketch source
data, empty authored features, and fresh sketch/feature/body counters.

Schema V2 projects migrate with their sketch source data intact, plus empty
authored features and fresh feature/body counters.

Schema V3 projects migrate with sketches and authored features intact, but
without attached sketch metadata because that source data did not exist in
schema V3.

Schema V4 projects migrate with sketches, authored features, and attached sketch
metadata intact, plus an empty named-reference table.

Schema V5 projects migrate with sketches, authored features, attached sketch
metadata, and named references intact. Authored extrude features without an
operation mode normalize to `newBody` and therefore must not include
`targetBodyId`.

Schema V6 projects migrate with all V6 source data intact, plus empty parameter
and sketch-dimension tables and fresh parameter/dimension counters.

Schema V7 projects migrate with parameters and sketch dimensions intact, plus an
empty sketch-constraint table and fresh sketch-constraint counter.

Schema V8 projects migrate with horizontal/vertical sketch constraints intact.
Fixed point constraints are a V9 source shape and are rejected in V8 documents.

Schema V9 projects migrate with fixed point constraints intact. Coincident point
constraints are a V10 source shape and are rejected in V9 documents.

Schema V10 projects migrate with coincident point constraints intact. Midpoint
constraints are a V11 source shape and are rejected in V10 documents.

Schema V11 projects migrate with midpoint constraints intact. Parallel line
constraints are a V12 source shape and are rejected in V11 documents.

Schema V12 projects migrate with parallel line constraints intact.
Perpendicular line constraints are a V13 source shape and are rejected in V12
documents.

Schema V13 projects migrate with perpendicular line constraints intact. Revolve
features are a V14 source shape and are rejected in V13 documents.

Schema V14 projects migrate with authored revolve features intact. Hole
features are a V15 source shape and are rejected in V14 documents.

The derived mapping is deterministic:

```text
document.objects[]                -> part:default
scene object <objectId>           -> feature:<objectId>
feature:<objectId>                -> body:<objectId>
document.features[] extrude       -> feat_N or caller-provided feature ID
document.features[] revolve       -> feat_N or caller-provided feature ID
extrude/revolve feature body      -> body_N or caller-provided body ID
sketch.createOnFace attachment    -> stored on the created sketch
```

Primitive-derived IDs are query/API affordances and are not separately
persisted as part/feature/body records. Authored extrude, revolve, hole,
chamfer, and fillet feature IDs and body IDs are persisted because they are
user-visible rebuild inputs.

This avoids duplicating source-of-truth state. Duplicated saved part/feature/body
records would create unnecessary consistency rules while primitive bodies remain
derivable from scene objects and extrude bodies remain derivable from their
feature records. Attached sketch metadata is persisted because it is authored
placement data for that sketch; generated body/face/edge/vertex reference query
results remain derived and are not persisted.

## Source Of Truth

The current source of truth is:

- `schemaVersion`
- `document.units`
- `document.objects`
- object IDs
- object display names
- object dimensions
- object transforms
- `document.nextObjectNumber`
- sketch IDs
- sketch names
- sketch planes
- sketch generated-face attachment metadata
- sketch entities and entity geometry
- document parameter IDs, names, numeric values, and optional descriptions
- sketch dimension IDs, names, source sketch/entity references, target roles,
  literal values, and parameter bindings
- sketch constraint IDs, names, source sketch/entity references, supported
  constraint kind, fixed coordinates, explicit point targets, midpoint
  line/target references, and parallel/perpendicular primary/secondary line
  references
- `document.nextSketchNumber`
- `document.nextSketchEntityNumber`
- `document.nextParameterNumber`
- `document.nextSketchDimensionNumber`
- `document.nextSketchConstraintNumber`
- authored feature IDs
- authored feature names
- authored feature kind and operation-specific source inputs for extrude,
  revolve, hole, chamfer, or fillet records
- authored extrude operation mode and optional target body ID
- authored revolve same-sketch axis, angle, operation mode, and body ID
- authored hole target body ID, source circle sketch/entity, depth mode/depth,
  direction, and body ID
- authored chamfer/fillet target body ID, generated or named edge reference,
  distance/radius, and body ID
- authored feature body IDs
- named generated reference names and targets
- `document.nextFeatureNumber`
- `document.nextBodyNumber`
- committed transaction history
- redo transaction history where practical
- optional transaction actor metadata
- optional transaction audit metadata

Transactions are preserved so undo/redo, command auditability, and future
rebuild/migration work have a stable record of how the current document was
produced.
The `transaction.history` query returns read-only summaries of this saved
transaction model for UI, scripts, agents, and MCP clients. Those summaries are
not separately persisted; they are derived from `history` and `redoStack`.
The `project.features` query currently returns read-only feature summaries. It
includes primitive feature summaries derived from `document.objects` and
authored sketch feature summaries derived from `document.features`. Primitive
summaries include the derived default part ID and derived body ID for each
object. Extrude summaries include the source sketch/entity, profile kind, depth,
side, operation mode, optional target body ID, and authored body ID. Revolve
summaries include the source sketch/entity, profile kind, same-sketch axis line,
angle, operation mode, and authored body ID. Hole, chamfer, and fillet summaries
include their target-consuming source inputs and authored result body IDs.

The `project.structure` query returns the current V2/V3/V4/V5/V6/V7/V8/V9/V10/V11/V12/V13/V14/V15/V16 compatibility bridge:

- one derived default part, `part:default`;
- one primitive feature per scene object, `feature:<objectId>`;
- one derived solid body per scene object, `body:<objectId>`;
- authored extrude/revolve/hole/chamfer/fillet features from
  `document.features`;
- authored sketch and result feature bodies referenced by those features; and
- object-to-part/feature/body source mappings.

When a supported target-consuming feature targets an authored body, the target
body remains listed as source/intermediate structure and is marked with
`consumedByFeatureId`. Current display treats the result body as the active
result and skips the consumed target body so the model is not double-rendered.
Project extents skip consumed target bodies. Boolean and V6 result bodies can
contribute extents when a matching ready derived exact metadata snapshot is
passed to the query; otherwise the query returns structured warnings rather
than mesh-derived or primitive fallback bounds.

This structure is a migration bridge toward a fuller feature/body model. The
primitive side remains derived; authored feature records are persisted because
they are source-of-truth feature data.

The `project.health` query returns read-only dependency health derived from the
same source-of-truth document. It reports authored feature source status,
attached sketch generated-face resolution and eligibility, parameter-bound
sketch dimension status, sketch constraint status, derived sketch evaluation
completeness status, affected authored features/bodies, named generated
reference target status, and topology/measurement confidence summaries. The
query may accept an optional `derivedExactMetadata` array containing the same
read-only snapshot shape used by `body.topology`. Matching snapshots can upgrade
health entry exact measurement confidence for authored extrude, revolve, hole,
chamfer, and fillet bodies; stale, unsupported, failed, unavailable, empty, or
invalid snapshots remain structured topology issues. Health entries may be
`healthy`, `under-defined`, `over-defined`, `stale`, `missing-source`, or
`unsupported`, with concise structured issues. These results are diagnostic
query data only; they are not persisted and do not form a separate parametric
regeneration graph.

The `body.generatedReferences` query returns the first read-only semantic
reference layer for authored sketch-extrude bodies. It derives a generated body
reference plus generated face, edge, and rectangle vertex references from the
saved extrude feature and its source sketch entity. These references are
currently available for standalone `newBody` authored rectangle/circle extrudes.
Cut result bodies intentionally return an unsupported generated-reference
response until boolean result topology and reference invalidation are designed.
The pre-cut target body's generated references can still resolve as source
references for rebuild inputs and existing attached sketches. Rectangle
extrudes expose start/end caps, four side face roles tied to profile edge roles (`side:uMin`,
`side:uMax`, `side:vMin`, `side:vMax`), start/end profile edge roles, four
longitudinal corner edge roles, and eight corner vertex roles
(`start:uMin:vMin`, `start:uMin:vMax`, `start:uMax:vMin`,
`start:uMax:vMax`, `end:uMin:vMin`, `end:uMin:vMax`, `end:uMax:vMin`, and
`end:uMax:vMax`). Circle extrudes expose start/end caps, one cylindrical side
role (`side:circular`), and start/end circular edge roles; they currently
return an empty vertex set because there are no stable discrete semantic
vertices for the circular profile. These references include source
feature/sketch/entity IDs, face, edge, or vertex roles, adjacent face roles for
edges and vertices, adjacent edge roles for vertices, sketch plane, extrude
side, profile kind, current source profile signature, and simple
normal/axis/curve/profile-point roles. They are not raw OCCT, mesh, or renderer
indexes and are not persisted as source-of-truth data.
Each reference also includes a deterministic read-only `label` and, where
useful, `description`. These are derived readability metadata for humans,
scripts, agents, and future UI panels. They are not persisted user names and do
not change stable IDs or resolver behavior.
Each reference also includes deterministic read-only `eligibleOperations` and,
where useful, `eligibilityNotes`. These advertise whether the semantic
reference is a plausible future candidate for `feature.attachSketchPlane`,
`feature.measureReference`, or `feature.selectReference`. For example, planar
faces can advertise sketch-plane attachment, while circular side faces cannot.
This is derived planning metadata only and does not implement those future
operations.

`reference.nameGenerated` lets a human, script, or agent assign a stable
source-of-truth name to an existing generated body, face, edge, or vertex
reference. The command validates that the generated reference resolves at the
time the name is created and stores the target body ID, generated stable ID, and
resolved kind. `reference.deleteName` removes the source-of-truth name without
mutating the generated reference or underlying geometry. `reference.listNamed`
lists named references and marks each target as resolved or stale.
`reference.resolveNamed` resolves one named reference to the current generated
reference object or returns a structured stale/missing-target error. Named
references are authored metadata; generated references and generated labels
remain derived from feature source data.

The companion `body.resolveGeneratedReference` query accepts a body ID and one
generated stable ID, then resolves it to the current body, face, edge, or vertex
reference object for that authored sketch-extrude body. This is still a
read-only derived query. Missing or stale stable IDs return a structured
`GENERATED_REFERENCE_NOT_FOUND` error rather than exposing raw OCCT, mesh, or
renderer indexes.

The `selection.referenceCandidates` query is the first V7 semantic
selection/reference contract. It accepts only semantic selections:
`{ type: "body", bodyId }`,
`{ type: "generatedReference", bodyId, stableId, expectedKind? }`, or
`{ type: "namedReference", name }`. It derives command-ready generated-reference
candidates from the authoritative document, current named references, and the
same generated-reference resolver described above. Supported rectangle/circle
`newBody` extrude selections can resolve to body, face, edge, or vertex
candidates with operation eligibility such as `reference.nameGenerated`,
`feature.attachSketchPlane`, `feature.chamfer`, `feature.fillet`,
`feature.measureReference`, and `feature.selectReference`. Unsupported,
missing, stale, ambiguous, consumed, kind-mismatched, and non-commandable
targets return structured diagnostics. Query inputs and outputs deliberately do
not use OCCT IDs, mesh IDs, renderer object IDs, selection-buffer indexes, or
other derived display/cache identifiers as stable public IDs.

The companion `body.generatedReferenceMeasurements` query accepts the same body
ID and generated stable ID and returns source-derived analytic measurements for
the matched semantic reference where practical. Current authored
rectangle/circle sketch-extrude bodies support body bounds/volume/centroid,
face area/bounds/center/normal-or-axis role, edge length and role-derived
location data, and rectangle vertex points. Circle extrudes intentionally do not
expose vertex measurements because the current circular profile has no stable
discrete semantic vertices. These measurements are derived query results, not
saved source data, and they are not exact persisted B-rep topology.

The `body.topology` query is the first V5/V6 exact/topology boundary. It accepts
a body ID and returns derived availability/status metadata for exact geometry,
topology, and exact measurement confidence. The response includes a deterministic
source identity/cache key derived from existing document source records, plus
structured topology issues such as unsupported body, stale source, ambiguous
topology, empty/invalid exact result, unavailable kernel binding, or kernel
failure. Rectangle and circle newBody authored extrudes return healthy
`semantic-source` topology snapshots with face/edge/vertex counts and
`source-analytic` measurement confidence when no kernel snapshot is supplied.
When an app or adapter has a derived exact metadata snapshot for the same source
identity, it may pass that snapshot into the read-only query. Matching snapshots
upgrade exact geometry/measurement availability to `kernel-derived`; stale,
unsupported, failed, or unavailable-binding snapshots are reported as structured
status/issues. Primitive compatibility bodies return `unsupported` snapshots,
and current boolean result bodies still do not claim generated semantic
topology roles. Boolean result bodies may report matching kernel-derived exact
metadata while keeping `topologyAvailable: false` until boolean topology naming
is deliberately scoped. Authored revolve bodies may also report matching
kernel-derived exact metadata while keeping generated references unsupported
until stable revolve topology roles are deliberately scoped. This query is
read-only derived data; it does not persist OCCT state, B-rep data, mesh data,
topology indexes, kernel metadata, or a new source-of-truth project field.
Authored hole result bodies may report matching kernel-derived exact metadata
while keeping generated references and semantic topology unavailable until
stable hole topology roles are deliberately scoped. Derived metadata-only
changes do not require a schema version.
Authored chamfer and fillet result bodies may report matching kernel-derived
exact metadata for the supported rectangle-edge subset while keeping generated
references and semantic topology unavailable until stable edge-finish topology
roles are deliberately scoped.

The `project.extents` query may also accept an optional
`derivedExactMetadata` array containing the same read-only snapshot shape used
by `body.topology`. Cad-core recomputes each active body's current source
identity from saved project data and only uses ready snapshots whose cache key
matches that source identity. Matching snapshots can contribute
kernel-derived bounds, volume, surface area, centroid, and topology counts for
authored revolve, hole, chamfer/fillet, and boolean result bodies when
source-derived extents are unavailable. Missing, stale, unsupported,
unavailable-binding, empty, invalid, and kernel-failed snapshots are reported
as structured project-extents warnings. Primitive bodies and simple
rectangle/circle newBody extrudes keep their existing source-derived extents.
The snapshots are query inputs only; they are not written to project JSON and
do not make mesh bounds or OCCT topology IDs authoritative.

`sketch.createOnFace` is the first command that consumes generated references.
It accepts either a body ID plus generated face stable ID, or a named reference
that resolves to a generated reference. Both paths resolve through the same
semantic generated-reference model, require the reference to be a face, and
require eligibility for `feature.attachSketchPlane`. It currently supports only
generated planar faces from authored sketch-extrude bodies. Circular side faces,
edges, vertices, bodies, missing/stale references, missing/stale named
references, and primitive-derived bodies fail with structured validation errors.
The created sketch stores only the resolved attachment metadata needed to
round-trip its authored placement; it does not persist generated topology,
named-reference lookup results, or exact B-rep data.

## Future Format Version Triggers

Do not introduce another format version just because query shapes changed. A
new project format is justified when the saved source-of-truth model gains data
that cannot be faithfully represented by the current `web-cad.project.v16`
document shape.

V6 introduced `web-cad.project.v14` when `feature.revolve` added the first
authored non-extrude feature source record. V6 introduced
`web-cad.project.v15` when `feature.hole` added the first circular
target-consuming feature source record. V6 introduced `web-cad.project.v16`
when command-first `feature.chamfer` and `feature.fillet` records added
edge-finishing source intent. Exact-kernel metadata, topology snapshots,
measurement outputs, mesh results, semantic selection/reference candidate query
outputs, and UI selection state remain derived and do not justify a schema
version by themselves.

Likely triggers:

- explicit authored parts with names/origins beyond the derived default part;
- future source-of-truth sketch profiles, solver state, expression records, or
  constraint families beyond current V13
  horizontal/vertical/fixed/coincident/midpoint/parallel/perpendicular
  constraints;
- additional feature records that require new persisted inputs beyond current
  extrude/revolve/hole, such as sweep, loft, shell, patterns, or edit
  features;
- body definitions or exact geometry checkpoints that are source of truth or
  required rebuild inputs;
- persisted durable topological references beyond the current semantic named
  generated references, such as exact topology-backed faces, edges, vertices,
  sketches, and features;
- assembly definitions, instances, mates, or material overrides;
- project-level materials/named views that are not represented by V16;
  or
- a command-log representation that cannot be preserved with current transaction
  history.

When any future source records become real source data, the next format should
be explicit:

```text
schemaVersion: web-cad.project.v17
```

That format should include a migration from older accepted versions, not silent
shape guessing. Current `web-cad.project.v16` preserves V1-V15 import
compatibility and adds only the currently implemented revolve, hole, chamfer,
and fillet source records. It does not persist B-rep checkpoints, OCCT topology
IDs, exact metadata query results, or tessellated mesh caches.

V3 Phase A introduced `web-cad.project.v7` when parameters and sketch dimensions
became persisted source-of-truth data. V3 Phase B introduced
`web-cad.project.v8` when line orientation constraints became persisted
source-of-truth data. V4 Phase B introduced `web-cad.project.v9` when fixed
point constraints became persisted source-of-truth data and
`web-cad.project.v10` when coincident point constraints became persisted
source-of-truth data, and `web-cad.project.v11` when midpoint constraints
became persisted source-of-truth data. V4 Phase B/C introduced
`web-cad.project.v12` when parallel line constraints became persisted
source-of-truth data and `web-cad.project.v13` when perpendicular line
constraints became persisted source-of-truth data. V6 Phase B introduced
`web-cad.project.v14` when authored revolve feature intent became persisted
source-of-truth data. V6 Phase D introduced `web-cad.project.v15` when authored
hole feature intent became persisted source-of-truth data. V6 Phase E core
introduced `web-cad.project.v16` when authored chamfer/fillet feature intent
became persisted source-of-truth data. Query-only
solver/evaluator summaries
such as `sketch.evaluation`, dependency health, generated-reference labels,
derived measurements, and renderer display frames should remain rebuildable
query/cache data and should not trigger a format version by themselves.

Future V7 or later slices should introduce another project format only if they
add persisted source-of-truth data that cannot be represented by the current V16
feature and constraint records. Solver/evaluator status, reference-candidate
status, export-readiness status, release-smoke metadata, and exact-kernel query
results should remain derived query/cache data.

## Rebuildable Cache

These are not source of truth and must not be required to load a project:

- OCCT tessellation results
- derived exact-kernel metadata results
- renderer meshes
- renderer buffers
- viewport camera state
- derived geometry status
- geometry-worker timing metrics
- browser smoke metrics
- read-only measurement and project extent query results
- read-only authored body measurement query results
- read-only transaction history summary query results
- read-only feature summary query results
- read-only project structure query results
- read-only project health/dependency query results
- read-only project sketch query formatting
- read-only generated body/face/edge/vertex reference query results
- read-only generated reference resolver query results
- read-only sketch evaluator query results
- read-only generated reference labels and descriptions
- read-only generated reference eligibility metadata
- read-only generated reference measurement query results
- attached sketch display frames derived from generated face references
- attached-sketch extrude placement frames derived from generated face
  references
- future LODs, BVHs, edge display buffers, and thumbnails

Derived meshes are display/cache artifacts. They are regenerated from the
authoritative document and geometry pipeline after load.
Measurements and extents are likewise recomputed from the loaded source-of-truth
document.

## Import Validation

`cad-core` validates the current JSON format explicitly before loading:

- project root shape
- `schemaVersion`
- document shape
- units
- object IDs
- object kinds
- object dimensions
- transforms
- object names
- sketch IDs
- sketch names
- sketch planes
- sketch entity IDs
- sketch entity kinds and geometry
- authored feature IDs
- authored feature kinds
- authored feature source sketch/entity references
- authored feature profile kinds, depths, sides, and body IDs
- named generated reference names and targets
- parameter IDs, names, finite numeric values, and optional descriptions
- sketch dimension IDs, names, source references, supported target roles
  including line length, and literal or parameter-bound value sources
- parameter-bound dimension references and positive resolved dimension values
- sketch constraint IDs, names, source references, supported horizontal/vertical
  line orientation kinds, fixed point targets, coincident point target pairs,
  midpoint line/target pairs, parallel/perpendicular line pairs, non-zero line
  targets,
  duplicate/conflicting orientation constraints, duplicate fixed/coincident/
  midpoint/parallel/perpendicular records, unsupported point-target roles, and
  consistency between saved line geometry and saved constraint intent
- transaction and semantic diff shape
- optional transaction audit metadata
- committed transaction stack status
- undone redo stack status
- duplicate transaction IDs across history and redo stack
- `nextObjectNumber` collisions with generated object IDs
- `nextSketchNumber` collisions with generated sketch IDs
- `nextSketchEntityNumber` collisions with generated sketch entity IDs
- `nextFeatureNumber` collisions with generated feature IDs
- `nextBodyNumber` collisions with generated body IDs
- `nextParameterNumber` collisions with generated parameter IDs
- `nextSketchDimensionNumber` collisions with generated sketch dimension IDs
- `nextSketchConstraintNumber` collisions with generated sketch constraint IDs
- optional transaction actor metadata
- transaction replay where practical
- consistency between the saved document and replayed committed transaction
  history when history or redo entries are present

Sketch generated-face attachment records may point at references that are
currently stale, such as after the source feature was deleted. The importer
keeps those records loadable when their shape is valid and lets `project.health`
report the stale/missing target. This preserves undo/redo and audit history
without pretending the generated face still resolves.

Invalid imports throw `CadProjectImportError` with structured issues:

```ts
CadProjectImportIssue {
  code: CadProjectImportErrorCode
  path: string
  message: string
}
```

The UI surfaces the formatted import error. Tests should assert structured error
codes and paths for malformed project files.

## Migration And Versioning

The current loader accepts:

```text
web-cad.project.v1
web-cad.project.v2
web-cad.project.v3
web-cad.project.v4
web-cad.project.v5
web-cad.project.v6
web-cad.project.v7
web-cad.project.v8
web-cad.project.v9
web-cad.project.v10
web-cad.project.v11
web-cad.project.v12
web-cad.project.v13
web-cad.project.v14
web-cad.project.v15
web-cad.project.v16
```

Schema V1 is migrated to V16 on parse/load by adding empty sketches, empty
authored features, empty named references, empty parameters, empty sketch
dimensions, empty sketch constraints, and fresh
sketch/feature/body/parameter/dimension/constraint counters. Schema V2 is
migrated to V16 by preserving sketches and adding empty authored features, empty
named references, empty parameters, empty sketch dimensions, empty sketch
constraints, and fresh feature/body/parameter/dimension/constraint counters.
Schema V3 is migrated to V16 by preserving sketches/features, treating all
sketches as unattached, adding empty named references, empty parameters, empty
sketch dimensions, empty sketch constraints, and defaulting authored extrude
operation mode to `newBody`.
Schema V4 is migrated to V16 by preserving sketches, authored features, and
attached sketch metadata, plus empty named-reference, parameter,
sketch-dimension, and sketch-constraint tables and `newBody` operation mode.
Schema V5 is migrated to V16 by preserving sketches, authored features, attached
sketch metadata, and named references while defaulting missing operation mode to
`newBody` and adding empty parameters, sketch dimensions, and sketch
constraints. Schema V6 is migrated to V16 by preserving all V6 source data and
adding empty parameters, sketch dimensions, and sketch constraints. Schema V7 is
migrated to V16 by preserving parameters and sketch dimensions and adding empty
sketch constraints. Schema V8 is migrated to V16 by preserving horizontal and
vertical sketch constraints. Schema V9 is migrated to V16 by preserving fixed
point constraints. Schema V10 is migrated to V16 by preserving coincident point
constraints. Schema V11 is migrated to V16 by preserving midpoint constraints
and rejecting parallel constraints because they are a V12 source shape. Schema
V12 is migrated to V16 by preserving parallel constraints and rejecting
perpendicular constraints because they are a V13 source shape. Schema V13 is
migrated to V16 by preserving perpendicular constraints and rejecting revolve
features because they are a V14 source shape. Schema V14 is migrated to V16 by
preserving authored revolve features and rejecting hole features because they
are a V15 source shape. Schema V15 is migrated to V16 by preserving authored
hole features and rejecting chamfer/fillet features because they are a V16
source shape. Current imports reject
inconsistent or unsupported extrude operation-mode contracts, such as `newBody`
with `targetBodyId`, `add`/`cut` without `targetBodyId`, boolean features
targeting missing, primitive-derived, or consumed bodies, circle-tool booleans,
circle-target add, and records outside the currently supported
rectangle-tool/active-target contracts.
Current imports also reject unsupported revolve records, including add/cut
operation modes, missing or zero-length sketch-line axes, unsupported profile
entities, and angles that are not positive finite values less than or equal to
360.
Current imports also reject unsupported hole records, including missing or
primitive-derived target bodies, already-consumed target bodies, non-circle
source entities, non-rectangle/circle newBody extrude targets, non-positive
blind depths, through-all depths, invalid directions, and stale attached sketch
references.
Current imports also reject unsupported chamfer/fillet records, including
missing or primitive-derived targets, already-consumed targets,
non-rectangle/circle newBody extrude targets, missing or mixed edge reference
paths, non-edge generated stable IDs, missing named references, named
references that point at the wrong body or kind, and non-positive
distance/radius values.
Unsupported versions fail with a structured
`UNSUPPORTED_PROJECT_VERSION` issue.

When another format is needed, add an explicit migration path rather than
silently accepting ambiguous shapes. A migration should:

1. Detect the incoming `schemaVersion`.
2. Validate that version's expected shape.
3. Convert it into the current authoritative document model.
4. Rebuild or explicitly author the default part/feature/body mapping.
5. Preserve or deliberately rewrite command history.
6. Report structured migration errors with paths.

Do not add more migration branches before another real format exists.

## V8 Native Package Direction

The active V8 plan chooses the first native package direction that was
previously deferred:

- user-visible extension: `.wcad`;
- package format version: `partbench.wcad.v1`;
- physical representation: ZIP-compatible package file with a
  directory-compatible internal layout;
- required authoritative package entries: `manifest.json`, `document.cbor`,
  and `commands.cbor`;
- current document schema: still `web-cad.project.v16` unless V8 adds new
  source-of-truth document data;
- next document schema if new source data is added: `web-cad.project.v17`;
- JSON remains explicit debug/interchange, not the primary native package
  encoding;
- OPFS entries, thumbnails, meshes, exact metadata snapshots, and export
  intermediates remain rebuildable cache unless a tranche explicitly promotes
  a file to source data.

This V8 package decision does not by itself add STEP import, persistent exact
B-rep checkpoints as source truth, assemblies, broad topology naming, WebGPU,
or production MCP auth.

The first V8 implementation slices add the typed package contract and minimal
package read/write helpers without changing project source format:

- `project.packageReadiness` reports the target package version, current
  document schema, required package entries, supported package read/write
  helpers, and deferred status for File System Access, OPFS cache writes, and
  STEP export.
- `partbench-source-v1` source identity is computed from encoded document and
  command bytes plus schema/units metadata.
- `.wcad` package helpers write ZIP-compatible package bytes containing
  `manifest.json`, `document.cbor`, and `commands.cbor`.
- `document.cbor` stores the current authoritative document snapshot, while
  `commands.cbor` stores current command history and redo stack data.
- Package reads validate manifest metadata, entry byte lengths, hashes, source
  identity, CBOR payloads, and the reconstructed project through the existing
  cad-core importer.
- Source identity excludes filenames, browser file handles, OPFS paths,
  viewport state, selection state, thumbnails, meshes, export artifacts, and
  cache-only data.
- Agent/MCP wrappers expose the same read-only query through thin pass-throughs;
  they do not gain arbitrary file access.
- This query-only contract does not introduce `web-cad.project.v17`.

## Long-Term Native Package Direction

The long-term architecture still points toward a documented native package
format. V8 implements the first `.wcad` package version; later releases can
expand the same logical layout with parts, assemblies, source B-rep checkpoints,
drawings, and richer metadata when those systems become real source data.

Likely shape:

```text
project.wcad/
  manifest.json
  document.cbor
  commands.cbor
  parts/
  assemblies/
  brep/
  meshes/
  edge-display/
  thumbnails/
  metadata/
```

In that future package, the likely source-of-truth files are:

- `manifest.json`
- `document.cbor`, containing source model data such as units, parts, sketches,
  features, bodies, assemblies, parameters, materials, and named views
- `commands.cbor`, containing command/transaction history
- exact geometry checkpoints when the B-rep model exists and checkpoints are
  required for robust rebuild/performance

Likely rebuildable cache files are:

- tessellated meshes
- edge display data
- GPU-ready buffers
- thumbnails
- geometry diagnostics

The current JSON format is the source-of-truth interchange format for the V4/V13
foundation. It is not the final storage backend and does not imply OPFS or File
System Access API behavior.

JSON export/import remains the deliberate debuggable interchange path. `.wcad`
is now the runtime project-file workflow for current supported projects, using
File System Access handles where available and upload/download fallback
elsewhere. Reporting that a browser exposes File System Access or OPFS APIs does
not make those APIs part of the saved project format. File handles, OPFS
directories, thumbnails, mesh caches, and export artifacts are not persisted as
authoritative source data.
