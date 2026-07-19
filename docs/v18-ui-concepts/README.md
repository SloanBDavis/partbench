# V18 UI direction: Precision CAD

These screens form one coherent power-user interface, not separate visual
concepts. The layout stays stable while the ribbon, viewport tools, and right
inspector adapt to the active workflow.

## Reference screens

- `f-mode-sketch.png` — sketch geometry, inference, constraints, dimensions,
  and solver status
- `f-mode-solid.png` — ordinary 3D selection with the full solid-feature
  ribbon and selection-driven shortcuts
- `f-mode-feature-edit.png` — explicit selection collectors, parameter fields,
  preview/readiness, validation, accept, and cancel
- `f-mode-inspect.png` — two-target measurement, named references, and mass
  properties
- `f-mode-project.png` — project metadata, parameters, human-readable history,
  and STEP export readiness

## Stable shell

- Dark global document header with command search and undo/redo
- White, mode-aware expert ribbon with compact labeled tools
- Persistent document and ordered feature tree on the left
- Large central viewport or task workspace
- Contextual inspector/editor on the right
- Compact status, selection-filter, coordinate, zoom, and unit controls below

Mode switching changes relevant tools without hiding the document structure or
removing access to advanced operations. Contextual recommendations accelerate
selection-driven work but never replace the complete tool surface.

These images define visual direction, not modeling scope. `docs/v18.md` is
normative when an illustrated control is outside the completed V17 command or
selection matrix. Unsupported illustrated controls—including the rollback bar,
Offset Face, Section, Pin Measurement, direct feature expressions, invented
project metadata, and account/notification UI—are omitted rather than rendered
as placeholders.
