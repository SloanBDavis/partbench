# Exact CAD sessions

`@web-cad/cad-runtime` connects the existing cad-core document engine and
OCCT/WASM exact evaluator without a browser. The web app imports the same source
resolver, artifact builder, metadata projection, and checkpoint persistence
through this package's `shared/*` exports. Browser downloads, workers, and OPFS
remain browser host responsibilities.

```ts
import { createCadSession } from "@web-cad/cad-runtime";

const session = createCadSession();
try {
  const result = await session.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      { op: "sketch.create", id: "profile", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "profile",
        id: "outline",
        center: [0, 0],
        width: 40,
        height: 24
      },
      {
        op: "feature.extrude",
        id: "base",
        bodyId: "plate",
        sketchId: "profile",
        entityId: "outline",
        depth: 4
      }
    ]
  });
  if (!result.ok) throw new Error(result.error.message);
  const evidence = await session.getCurrentExactEvidence();
  const nativeBytes = await session.exportWcad();
  const step = await session.exportStep({ bodyIds: ["plate"] });
  // The caller owns writing nativeBytes and step.bytes to its chosen destination.
} finally {
  session.dispose();
}
```

## Session contract

- `executeBatch(batch)` submits existing CADOps. `execute(request)` uses the
  existing agent request adapter, permissions, reviews, and semantic diffs.
- `query(request)`, `inspectV8ProjectSurface(request)`, and
  `getCurrentSelection(request)` accept the existing agent-adapter request
  types. Exact queries refresh OCCT evidence before returning through the
  adapter's public-reference projection.
- `getCurrentExactEvidence()` returns internal cad-core evidence: current exact
  status, measured bounds/volume/topology, and artifact identity. Use the agent
  query methods when exposing results to an agent; raw topology-local IDs belong
  inside the geometry boundary.
- `exportWcad()` returns native `.wcad` bytes, including required checkpoint
  payloads. `openWcad(bytes)` validates the complete native package before
  replacing the live document. It returns the source identity.
- `exportStep({ bodyIds? })` evaluates current exact bodies and returns AP242
  bytes plus `fileName`, `mimeType`, `bodyCount`, `byteLength`, units, and the
  source-bound plan. STEP exports selected part definition bodies. Assembly
  instances and mates are preserved by the native project, not serialized as a
  STEP assembly by this exporter.
- `getSessionInfo()` is a synchronous snapshot of current source identity and
  cache/build counters. Await preceding operations before requesting their
  resulting state. Session construction and discovery do not load OCCT.
- `dispose()` closes the session, releases its caches, and rejects queued work.
  OCCT's loaded WASM module is shared by the process and remains available to
  other sessions.

All asynchronous session methods serialize against each other. A command worker
applies the same batch to an isolated cad-core candidate and evaluates all
active exact bodies before the live commit. Dry-run uses the same geometry
validation and leaves source/history untouched. A rejected geometric edit
returns a structured CADOps error and does not commit. The public `engine` and
`adapter` properties support host integration; writing directly through them
bypasses session serialization and exact preflight.

The runtime uses the browser's complete existing source resolver, including
feature dependencies and saved exact checkpoints. It does not create a second
primitive-only modeling implementation or add new feature composition support.
The existing restrictions on which features can consume each other still apply.

Headless evaluation omits triangulation and viewport pick maps. Geometry is
reused by body source identity; the session's default LRU retains at most 128
artifacts and 64 MiB of B-rep bytes, configurable with
`maxArtifactCacheEntries` and `maxArtifactCacheBytes`. Zero disables retention.
Repeated inspection at the same source epoch reuses current evidence. Native
files contain authoritative source and required checkpoints, not this optional
cache.

Run `pnpm --filter @web-cad/cad-runtime test` and
`pnpm --filter @web-cad/cad-runtime typecheck` for focused verification. The
release's real MCP create/revise/save/reopen/export journeys are documented in
[`docs/agent-runtime.md`](../../docs/agent-runtime.md).
