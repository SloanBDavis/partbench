# Package ownership

- Document: `cad-core` owns transactions, undo/redo, eligibility, and
  semantic diffs.
- Geometry: `occt-wasm`, `geometry-kernel`, and `geometry-worker` own
  exact B-rep and derived artifacts.
- Pick maps: `renderer` owns display picks; `apps/web` projects them
  into CADOps evidence. React does not invent topology.
- UI: `apps/web` submits CADOps. It does not own the document.
- MCP: `mcp-adapter` wraps `agent-adapter`. No second API.

## File-level examples

Pick a current exact face:

- `apps/web` projects the pick into `currentTopologyEvidence`.
- `cad-core` answers `selection.referenceCandidates`.
- Durable identity is a topology-anchor ID after promotion.

Create a feature:

- `cad-protocol` names the op.
- `cad-core` applies the batch and returns a semantic diff.
- `apps/web` Apply and `mcp-adapter` submit that same batch.

Exact measure:

- Geometry packages compute the measurement.
- The UI and MCP display public results.
- Raw exact local IDs never appear in commands, diffs, JSON, or text.
