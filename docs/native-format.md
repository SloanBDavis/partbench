# Native format

The native project format remains `web-cad.project.v22`, and the native file
format remains `partbench.wcad.v2`.

The completed format specification and compatibility history are archived in
[`docs/archive/native-format.md`](./archive/native-format.md).

## Independent model-space drawing entities

DRAW-001 adds optional `drawingEntities` to the existing document and
history-baseline snapshots. Each record has a stable `id`, a `kind` (`line`,
`rectangle`, or `circle`), and finite 2D geometry in document units. Lines and
rectangles store `start`/`end`; circles store `center`/positive `radius`.
These records are independent of sketch source, constraints, and BRep assets.
An absent array means an empty drawing. Commands, Undo/Redo replay, and native
validation preserve identity and reject malformed or duplicate records. No
native version changes. See [the drawing workspace](drawing-workspace.md).
