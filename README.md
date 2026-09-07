# Partbench

Partbench is an open-source, browser-native, AI-native CAD application.

CADOps is the center. cad-core is the document authority. OCCT/WASM is the
geometry authority. Meshes, picks, and previews are derived display.

V22–V26 and the [agent runtime release](docs/agent-runtime.md) are complete.
Native formats remain `web-cad.project.v22` and `partbench.wcad.v2`.

Start at [AGENTS.md](./AGENTS.md).

## Setup

Node.js 22 and pnpm 10.

```sh
pnpm install
pnpm dev
```

Verify (typecheck plus CADOps scenarios):

```sh
pnpm verify
```

Fast assembly E2E checks (Bun 1.4.2+ and Chrome required):

```sh
pnpm smoke:e2e
```

Connected local MCP session:

```sh
pnpm --filter @web-cad/mcp-stdio-server start
```

Headless MCP session (Node 22; build once, then run the executable):

```sh
pnpm --filter @web-cad/mcp-stdio-server build
mkdir -p ./cad-workspace
node packages/mcp-stdio-server/dist/stdio.js --headless --workspace ./cad-workspace
```

See [agent runtime usage](docs/agent-runtime-usage.md) for modeling, exact
inspection, revision, native save/reopen, STEP export, and current limits.
`pnpm smoke:agent-runtime` verifies the two complete headless journeys locally;
`pnpm benchmark:cad-runtime` reports startup and warm-operation measurements.

## Documentation

- [Robot arm agent trial: findings and next-work priorities](docs/robot-arm-trial.md)
- [How we work](docs/how-we-work.md)
- [Architecture](docs/architecture.md)
- [Agent runtime goal](docs/agent-runtime.md)
- [Agent runtime usage](docs/agent-runtime-usage.md)
- [Agent runtime verification and measurements](docs/agent-runtime-verification.md)
- [V26](docs/v26.md)
- [V25](docs/v25.md)
- [V24](docs/v24.md)
- [V23](docs/v23.md)
- [Native format](docs/native-format.md)
- [Skills](docs/skills/)
