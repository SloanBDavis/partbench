# Agent instructions

Partbench is an open-source, browser-native, AI-native CAD application.

CADOps is the center. cad-core is the document authority (transactions, undo/redo, semantic diffs). OCCT/WASM is the geometry authority. Meshes, picks, and previews are derived display.

- How we work: [docs/how-we-work.md](docs/how-we-work.md)
- Proof / close loop: [docs/verification.md](docs/verification.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Skills: [docs/skills/](docs/skills/)
- Current user goal: [docs/parity-roadmap.md](docs/parity-roadmap.md) (fastest path to professional CAD parity; E2E-only development).
- Feature completion authority: [docs/cad-feature-matrix.md](docs/cad-feature-matrix.md) (binary Done / Not done; edit its JSON source, retain IDs and evidence, regenerate with `pnpm cad:matrix`; select work with `pnpm cad:matrix --next`).
- Latest implementation: [docs/import-performance.md](docs/import-performance.md) (bounded parallel import, reduced serialization/render work, exact native parity and worker cancellation; cold-view and frame-time targets remain open).
- Interchange contracts: [docs/editable-interchange.md](docs/editable-interchange.md) (shared editable STEP/DXF/SVG interchange).
- Latest user trial: [docs/engine-step-trial.md](docs/engine-step-trial.md) (historical engine import failure and source provenance; follow-up implementation evidence linked).
- Last completed user goal: [docs/gearbox-workflow.md](docs/gearbox-workflow.md) (agent authoring, coherent revision and motion). V22–V26, [agent runtime](docs/agent-runtime.md), and [robot arm fixes](docs/robot-arm-fixes.md) are complete. Do not reopen or invent V27.

Do not open [docs/archive/](docs/archive/), docs/implementation-plan.md, or per-gate markdown unless the current user-goal doc names them.

Land on main as Sloan Davis <sloanbdavis@gmail.com>. Never open pull requests.

## Run the app

Node.js 22 and pnpm 10.

## Testing policy and daily scripts

Only end-to-end tests. Never add unit, component, isolated integration, snapshot,
or mocked tests; never restore Vitest or another unit-test runner. Extend an
existing real browser or public MCP journey before adding a new one. Keep setup
and assertions shared, and minimize the number of independent journeys.

- `pnpm dev` — workbench.
- `pnpm typecheck` / `pnpm lint` — static checks; use package typechecks while editing.
- `pnpm test` — consolidated E2E suite (browser assembly + interchange, public MCP).
- `pnpm test:e2e -- assembly|interchange|agent` — affected journeys only; accepts multiple names.
- `pnpm cad:matrix --next` — ordered feature contracts and unmet prerequisites.
- `pnpm verify` — matrix integrity, typecheck and consolidated E2E suite before landing.

Do not run Chromium on every save. Do not replay historical version gauntlets.
`scenarios/` CADOps are reusable fixtures. Browser `applyOps` alone is not E2E
acceptance.
See [docs/verification.md](docs/verification.md) for focused and large-workload checks.

## Slice close

Choose a feature-matrix contract. Keep its status Not done until its full written
acceptance passes. No partial states or percentage scoring. Record dated E2E
evidence before marking Done; reset known regressions to Not done. Do not split
passing rows, weaken targets or remove gaps to inflate the count. Regenerate the
matrix when its JSON changes. Specialist catalog coverage does not authorize
new dependencies, paid services or native format changes by itself.

Static checks plus the affected real browser/public MCP journey. UI work must
exercise actual controls, a visible result, and one rejected/blocked operation.
Consolidate those assertions into the existing journey. Record actual results;
never claim a skipped, missing-tool, or failed journey passed.

## Packages

- apps/web - browser UI
- packages/cad-protocol - command schemas and shared types
- packages/cad-core - document model, transactions, undo/redo
- packages/renderer - rendering abstraction and simple viewport
- packages/renderer-mesh-bridge - derived mesh adapter for the renderer
- packages/geometry-kernel - typed geometry facade
- packages/geometry-worker - async geometry worker boundary
- packages/occt-wasm - isolated OCCT/WASM integration
- packages/sketch-solver - pure TypeScript 2D sketch solver
- packages/agent-adapter - structured CADOps adapter for external callers
- packages/cad-runtime - shared exact evaluation and headless CAD sessions
- packages/mcp-adapter - MCP tool wrapper over the agent adapter
- packages/mcp-stdio-server - local stdio JSON-RPC MCP transport
