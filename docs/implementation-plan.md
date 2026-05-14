# Implementation Plan

Work in milestones. Do not skip ahead.

## Milestone 0: Repo Foundation

Goal: create a clean monorepo that can support the project.

Deliverables:

- TypeScript monorepo
- `apps/web`
- `packages/cad-protocol`
- `packages/cad-core`
- `packages/renderer`
- Shared TypeScript config
- Test setup
- Lint/format setup
- Basic CI-ready scripts
- A simple browser app that loads successfully

No CAD geometry is required in this milestone.

## Milestone 1: CADOps Protocol and Command Engine

Goal: implement the typed command layer.

Deliverables:

- Command schema for:
  - `scene.createBox`
  - `scene.createCylinder`
  - `scene.deleteObject`
  - `scene.updateTransform`
  - `transaction.undo`
  - `transaction.redo`
- In-memory document model
- Transaction log
- Undo/redo
- Semantic diffs
- Unit tests

## Milestone 2: Basic Viewport

Goal: display simple geometry created by the command engine.

Deliverables:

- 3D viewport
- Render boxes and cylinders
- Camera orbit/pan/zoom
- Object selection
- Inspector panel
- No exact CAD kernel yet

## Milestone 3: Worker Boundary

Goal: establish the future geometry-worker architecture.

Deliverables:

- Worker interface
- Mock geometry worker
- Async command execution path
- Tests proving UI state does not depend on synchronous geometry execution

## Milestone 4: WASM Kernel Spike

Goal: evaluate Open CASCADE or an OCCT-compatible WASM wrapper.

Deliverables:

- Isolated prototype
- Create primitive shape
- Tessellate to mesh
- Return typed arrays
- Document performance and integration risks

## Milestone 5: AI/MCP Adapter Spike

Goal: expose the existing command engine through an agent-friendly API.

Deliverables:

- JSON command batch interface
- Dry-run mode
- Commit mode
- Structured diff response
- Minimal MCP adapter if appropriate

## Rules

Each milestone should be implemented with tests.

Agents should only implement the milestone explicitly requested in the prompt.

If a requested milestone requires changing this plan, Agents should propose the change first instead of silently expanding scope.