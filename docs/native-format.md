# Native Project Format

This document describes the current source-of-truth project format and the
direction for the future native package format. It is intentionally scoped to
V1 Phase E and does not introduce OPFS, File System Access API, STEP
import/export, real topology, or a final `.wcad` package implementation.

## Current Format

The current saved format is deliberate JSON:

```text
schemaVersion: web-cad.project.v1
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

The web app Project panel uses this same format for the current V1 save/load
flow. It can generate/download current project JSON, load JSON into an import
preview, and show schema/version, object count, transaction count, redo count,
and structured validation issues before import. The preview uses the same
importability checks as load, including transaction replay, so malformed history
is blocked before the user imports it. This remains ordinary JSON import/export
and does not use OPFS or the File System Access API.

The current JSON shape is:

```ts
ProjectV1 {
  schemaVersion: "web-cad.project.v1"
  document: {
    units: "mm" | "cm" | "m" | "in"
    objects: SceneObject[]
    nextObjectNumber: number
  }
  history: Transaction[]
  redoStack: Transaction[]
}
```

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
  ops: CadOp[]
  diff: SemanticDiff
}
```

The actor records where the committed mutation came from. It is audit metadata,
not an authorization system.

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

Transform {
  translation: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}
```

Numbers in dimensions must be positive and finite. Transform vectors must have
exactly three finite numbers. Object names are optional, but if present they
must be non-empty after trimming. Duplicate object names are allowed for now.

Document units are explicit but still simple. `document.updateUnits` supports
two modes:

- `metadataOnly`: changes `document.units` while leaving existing numeric
  dimensions and transform translations unchanged.
- `preservePhysicalSize`: changes `document.units` and scales current
  box/cylinder dimensions plus transform translations so physical size is
  preserved.

The project file stores the resulting authoritative document values and the
transaction diff that explains how the unit change happened.

## Source Of Truth

The source of truth is:

- `schemaVersion`
- `document.units`
- `document.objects`
- object IDs
- object display names
- object dimensions
- object transforms
- `document.nextObjectNumber`
- committed transaction history
- redo transaction history where practical
- optional transaction actor metadata

Transactions are preserved so undo/redo, command auditability, and future
rebuild/migration work have a stable record of how the current document was
produced.
The `transaction.history` query returns read-only summaries of this saved
transaction model for UI, scripts, agents, and MCP clients. Those summaries are
not separately persisted; they are derived from `history` and `redoStack`.
The `project.features` query currently returns read-only primitive feature
summaries derived from `document.objects` and committed transaction history. It
is a migration bridge toward future feature/body concepts, not a saved feature
graph in this format.

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
- read-only transaction history summary query results
- read-only primitive feature summary query results
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
- transaction and semantic diff shape
- committed transaction stack status
- undone redo stack status
- duplicate transaction IDs across history and redo stack
- `nextObjectNumber` collisions with generated object IDs
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

The current loader accepts only:

```text
web-cad.project.v1
```

Unsupported versions fail with a structured `UNSUPPORTED_PROJECT_VERSION`
issue. That is intentional until a second real format exists.

When a new format is needed, add an explicit migration path rather than
silently accepting ambiguous shapes. A future migration should:

1. Detect the incoming `schemaVersion`.
2. Validate that version's expected shape.
3. Convert it into the current authoritative document model.
4. Preserve or deliberately rewrite command history.
5. Report structured migration errors with paths.

Do not add migration branches before a real older/newer format exists.

## Future Native Package Direction

The long-term architecture still points toward a documented native package
format, likely a directory or ZIP-like package:

```text
project.wcad/
  manifest.json
  document.cbor
  commands.cbor
  brep/
  meshes/
  thumbnails/
  metadata/
```

In that future package, the likely source-of-truth files are:

- `manifest.json`
- `document.cbor`
- `commands.cbor`
- exact geometry checkpoints when the B-rep model exists

Likely rebuildable cache files are:

- tessellated meshes
- edge display data
- GPU-ready buffers
- thumbnails
- geometry diagnostics

The current JSON format is the V1 source-of-truth interchange/debug format. It
is not the final storage backend and does not imply OPFS or File System Access
API behavior.
