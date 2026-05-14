# Web CAD

An open-source, browser-native, AI-native CAD application. Milestone 0 sets up
the TypeScript monorepo foundation only; CAD geometry and command execution come
in later milestones.

## Requirements

- Node.js 22 or newer
- pnpm 10

## Setup

Install workspace dependencies:

```sh
pnpm install
```

## Development

Run the browser app:

```sh
pnpm dev
```

Run the full build:

```sh
pnpm build
```

Run package tests:

```sh
pnpm test
```

Run lint and format checks:

```sh
pnpm lint
pnpm format:check
```

Run TypeScript checks:

```sh
pnpm typecheck
```

## Workspace Layout

- `apps/web` - Vite browser shell
- `packages/cad-protocol` - shared protocol package placeholder
- `packages/cad-core` - core document and transaction package placeholder
- `packages/renderer` - renderer abstraction package placeholder

## Current Limitations

- No CAD geometry is implemented yet.
- No command protocol or transaction engine is implemented yet.
- No Open CASCADE, WASM, MCP, OPFS, STEP import/export, or WebGPU integration is
  included in this milestone.
