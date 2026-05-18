# Native Project Format

This document describes the current source-of-truth project format and the
direction for the future native package format. The V1 format is complete as a
JSON source-of-truth interchange format. V2 added source-of-truth sketches, V3
added the first authored sketch-driven feature data, V4 added source-of-truth
sketch attachment metadata for sketches created on generated planar face
references, and V5 added source-of-truth user/agent names for generated
references. Current exports use `web-cad.project.v5` while the loader still
accepts V1, V2, V3, and V4 projects through explicit migration. Future storage work
should use this document to evolve toward a native package without prematurely
introducing OPFS, File System Access API, STEP import/export, real topology, or
a final `.wcad` implementation.

## Current Format

The current saved format is deliberate JSON:

```text
schemaVersion: web-cad.project.v1
schemaVersion: web-cad.project.v2
schemaVersion: web-cad.project.v3
schemaVersion: web-cad.project.v4
schemaVersion: web-cad.project.v5
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

The web app Project panel uses this same format for the V1 save/load flow. It
can generate/download current project JSON, load JSON into an import preview,
and show schema/version, object count, transaction count, redo count, and
structured validation issues before import. The preview uses the same
importability checks as load, including transaction replay, so malformed history
is blocked before the user imports it. This remains ordinary JSON import/export
and does not use OPFS or the File System Access API.

The current exported JSON shape is:

```ts
ProjectV5 {
  schemaVersion: "web-cad.project.v5"
  document: {
    units: "mm" | "cm" | "m" | "in"
    objects: SceneObject[]
    sketches: Sketch[]
    features: ExtrudeFeature[]
    namedReferences: NamedGeneratedReference[]
    nextObjectNumber: number
    nextSketchNumber: number
    nextSketchEntityNumber: number
    nextFeatureNumber: number
    nextBodyNumber: number
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
and are not persisted. Sketches do not yet include constraints, solving,
source-level coordinate remapping for attached faces, or automatic profile
recognition. The viewport and derived geometry pipeline may derive a frame from
the current generated face reference so attached sketches render on the
referenced face and existing `feature.extrude` bodies sourced from those
sketches can be displayed from that face. Those frames and meshes are
rebuildable view/cache data and are not saved.

Current authored features are source-of-truth V3 document data:

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
  bodyId: string
}
```

Extrude features reference an existing rectangle or circle sketch entity. The
saved feature record is the rebuild input. The body mesh produced from it is
derived cache data and is not saved in the project JSON. Feature IDs and body
IDs must be unique within their respective authored/derived ID spaces. Extrude
depth must be positive and finite. Extrude side can be `positive`, `negative`,
or `symmetric` relative to the sketch-plane normal. This slice does not include
a sketch solver, arbitrary profile recognition, topological references, broad
feature edit commands, or exact B-rep checkpoint persistence. Authored
sketch-extrude features can be removed with `feature.delete` and can have depth
and side updated with `feature.updateExtrude`. Missing side values in older
compatible project data normalize to `positive`.
Rectangle and circle source profile values can be edited through
`sketch.updateEntity`; the feature keeps referencing the same sketch entity and
the generated body is rebuilt as derived geometry. Primitive-derived
compatibility features are not deletable through `feature.delete` or editable
through `feature.updateExtrude`.

## V2/V3/V4/V5 Storage Decision

The derived V2 part/feature/body bridge did not require a format change because
it is rebuilt from scene objects. Sketches are different: they are authored CAD
source data that cannot be reconstructed from V1 objects and transaction history
unless their commands remain in history forever. That introduced
`web-cad.project.v2`.

The first sketch-driven feature operation, `feature.extrude`, is also authored
CAD source data. It cannot be represented faithfully by only primitive objects
and sketches, so it introduced `web-cad.project.v3`. Current exports therefore
used `web-cad.project.v3`.

The first reference-consuming command, `sketch.createOnFace`, adds authored
sketch attachment metadata. The attachment records the body ID, generated face
stable ID, source feature/sketch/entity IDs, and face role that the sketch was
created on. That data is not derivable from a plain plane sketch, so it
introduced `web-cad.project.v4`.

Named generated references are also authored source-of-truth metadata. They are
not derivable from generated labels because labels are deterministic system
metadata, while named references are chosen by a user, script, or agent. This
introduced `web-cad.project.v5`. Current exports therefore use
`web-cad.project.v5`.

The loader accepts:

```text
web-cad.project.v1
web-cad.project.v2
web-cad.project.v3
web-cad.project.v4
web-cad.project.v5
```

V1 projects migrate into the current in-memory model with unchanged units,
objects, object counters, history, and redo history, plus empty sketch source
data, empty authored features, and fresh sketch/feature/body counters.

V2 projects migrate with their sketch source data intact, plus empty authored
features and fresh feature/body counters.

V3 projects migrate with sketches and authored features intact, but without
attached sketch metadata because that source data did not exist in V3.

V4 projects migrate with sketches, authored features, and attached sketch
metadata intact, plus an empty named-reference table.

The derived mapping is deterministic:

```text
document.objects[]                -> part:default
scene object <objectId>           -> feature:<objectId>
feature:<objectId>                -> body:<objectId>
document.features[] extrude       -> feat_N or caller-provided feature ID
extrude feature body              -> body_N or caller-provided body ID
sketch.createOnFace attachment    -> stored on the created sketch
```

Primitive-derived IDs are query/API affordances and are not separately
persisted as part/feature/body records. Authored extrude feature IDs and body IDs
are persisted because they are user-visible rebuild inputs.

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
- `document.nextSketchNumber`
- `document.nextSketchEntityNumber`
- authored feature IDs
- authored feature names
- authored feature kind, source sketch, source entity, profile kind, depth, and
  side
- authored feature body IDs
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
authored sketch-extrude feature summaries derived from `document.features`.
Primitive summaries include the derived default part ID and derived body ID for
each object. Extrude summaries include the source sketch/entity, profile kind,
depth, side, and authored body ID.

The `project.structure` query returns the current V2/V3/V4/V5 compatibility bridge:

- one derived default part, `part:default`;
- one primitive feature per scene object, `feature:<objectId>`;
- one derived solid body per scene object, `body:<objectId>`;
- authored extrude features from `document.features`;
- authored sketch-extrude bodies referenced by those features; and
- object-to-part/feature/body source mappings.

This structure is a migration bridge toward a fuller feature/body model. The
primitive side remains derived; the authored extrude side is persisted because it
is source-of-truth feature data.

The `body.generatedReferences` query returns the first read-only semantic
reference layer for authored sketch-extrude bodies. It derives a generated body
reference plus generated face, edge, and rectangle vertex references from the
saved extrude feature and its source sketch entity. Rectangle extrudes expose
start/end caps, four side face roles tied to profile edge roles (`side:uMin`,
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

The companion `body.generatedReferenceMeasurements` query accepts the same body
ID and generated stable ID and returns source-derived analytic measurements for
the matched semantic reference where practical. Current authored
rectangle/circle sketch-extrude bodies support body bounds/volume/centroid,
face area/bounds/center/normal-or-axis role, edge length and role-derived
location data, and rectangle vertex points. Circle extrudes intentionally do not
expose vertex measurements because the current circular profile has no stable
discrete semantic vertices. These measurements are derived query results, not
saved source data, and they are not exact persisted B-rep topology.

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
that cannot be faithfully represented by the current `web-cad.project.v5`
document shape.

Likely triggers:

- explicit authored parts with names/origins beyond the derived default part;
- sketch constraints, dimensions, profiles, or solver state;
- additional feature records that require new persisted inputs, such as revolve,
  sweep, loft, shell, patterns, or edit features;
- body definitions or exact geometry checkpoints that are source of truth or
  required rebuild inputs;
- persisted durable topological references beyond the current semantic named
  generated references, such as exact topology-backed faces, edges, vertices,
  sketches, and features;
- assembly definitions, instances, mates, or material overrides;
- project-level parameters/materials/named views that are not represented by V5;
  or
- a command-log representation that cannot be preserved with current transaction
  history.

When any of those become real source data, the next format should be explicit:

```text
schemaVersion: web-cad.project.v6
```

That format should include a migration from older accepted versions, not silent
shape guessing.

## Rebuildable Cache

These are not source of truth and must not be required to load a project:

- OCCT tessellation results
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
- read-only project sketch query formatting
- read-only generated body/face/edge/vertex reference query results
- read-only generated reference resolver query results
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
- optional transaction actor metadata
- transaction replay where practical
- consistency between the saved document and replayed committed transaction
  history when history or redo entries are present

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
```

V1 is migrated to V5 on parse/load by adding empty sketches, empty authored
features, empty named references, and fresh sketch/feature/body counters. V2 is
migrated to V5 by preserving sketches and adding empty authored features, empty
named references, and fresh feature/body counters. V3 is migrated to V5 by
preserving sketches/features, treating all sketches as unattached, and adding
empty named references. V4 is migrated to V5 by preserving sketches, authored
features, and attached sketch metadata, plus an empty named-reference table.
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

## Future Native Package Direction

The long-term architecture still points toward a documented native package
format, likely a directory or ZIP-like package. This is not implemented yet.

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

The current JSON format is the source-of-truth interchange format for the active
V2/V3/V4/V5 foundation. It is not the final storage backend and does not imply OPFS
or File System Access API behavior.

JSON export/import remains the deliberate debuggable interchange path and
`.wcad` remains a documented direction rather than a runtime storage feature.
