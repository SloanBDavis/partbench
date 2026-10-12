# Partbench

Partbench is an open-source, browser-native, AI-native CAD application.

CADOps is the center. cad-core is the document authority. OCCT/WASM is the
geometry authority. Meshes, picks, and previews are derived display.

V22–V26, the [agent runtime release](docs/agent-runtime.md), and the
[connected robot arm fixes](docs/robot-arm-fixes.md) and
[parametric gearbox workflow](docs/gearbox-workflow.md) are complete.
Native formats remain `web-cad.project.v22` and `partbench.wcad.v2`.

Start at [AGENTS.md](./AGENTS.md).

## Setup

Node.js 22 and pnpm 10.

```sh
pnpm install
pnpm dev
```

Verify (matrix integrity, typecheck and consolidated E2E journeys):

```sh
pnpm verify
```

E2E checks (Bun 1.4.2+ and Chrome required):

```sh
pnpm test
# Focus on one workflow:
pnpm test:e2e -- interchange
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

Only E2E tests; no unit or component tests. See [testing policy](docs/verification.md)
and the [CAD parity roadmap](docs/parity-roadmap.md).

Choose the next feature contract with `pnpm cad:matrix --next`. Edit
`docs/cad-feature-matrix.json` and run `pnpm cad:matrix` to update the binary
feature table.

## Documentation

- [Professional CAD feature matrix: Done / Not done](docs/cad-feature-matrix.md)
- [Implementation order and hill-climbing roadmap](docs/parity-roadmap.md)

- [Parametric gearbox: agent authoring, ratio revision and motion](examples/gearbox-workflow/README.md)
- [Gearbox workflow fixes and verification](docs/gearbox-workflow.md)
- [Connected robot arm: example and revision workflow](examples/robot-arm-workflow/README.md)
- [Robot arm workflow fixes and verification](docs/robot-arm-fixes.md)
- [Robot arm agent trial: findings and next-work priorities](docs/robot-arm-trial.md)
- [Independent gearbox trial: motion, revision, and workflow findings](docs/gearbox-trial.md)
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
