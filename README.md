# Partbench

Partbench is an open-source, browser-native, AI-native CAD application.

CADOps is the center. cad-core is the document authority. OCCT/WASM is the
geometry authority. Meshes, picks, and previews are derived display.

V22–V25 are complete. V26 is the current user goal ([docs/v26.md](docs/v26.md)).
Native formats remain `web-cad.project.v22` and `partbench.wcad.v2` until V26
proves a persist gap.

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

Connected local MCP session:

```sh
pnpm --filter @web-cad/mcp-stdio-server start
```

## Documentation

- [How we work](docs/how-we-work.md)
- [Architecture](docs/architecture.md)
- [V26 user goal](docs/v26.md)
- [V25](docs/v25.md)
- [V24](docs/v24.md)
- [V23](docs/v23.md)
- [Native format](docs/native-format.md)
- [Skills](docs/skills/)
