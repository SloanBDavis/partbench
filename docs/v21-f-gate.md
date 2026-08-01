# V21 Gate F Cross-Consumer Evidence

Recorded: **2026-08-01**  
Implementation commits: `138940f`, `61a92d2`

## Result

One pure app projection now composes authoritative resolver state with current
display and exact-metadata evidence. It binds evidence to the semantic body
source identity and derived cache identity, applies the documented
`unsupported`, `blocked`, active `pending`, terminal `failed`, `stale`, then
`ready` precedence, and exposes no renderer, mesh, pixel, selection-buffer, or
OCCT execution identity.

Imported bodies and completed checkpoint-backed imported downstream add, cut,
hole, chamfer, and fillet results now use the same exact-body dispatcher for
display mesh and exact metadata. The geometry worker routes both operations
through the same checkpoint-validated OCCT shape. Replacing the source replaces
the display source/cache key, so an old ready mesh cannot remain current.

Project summary, project health, export readiness, and exact-export planning
accept the same bounded current-exact evidence and reconcile it against
cad-core's authoritative support/lifecycle classification and source identity.
Unsupported and blocked source rows cannot be promoted by caller evidence, and
a mismatched ready identity becomes stale. The app supplies the same projection
to Project/File, Inspect, modeling status, health, readiness, and export.
Body-level measurements, topology, and mass properties remain unavailable
until their current exact result is ready; generated-reference and topology
anchor measurement contracts are unchanged.

The table-driven gate proof crosses every frozen V21 body-policy row with all
six statuses. A second table proves each status is identical in project
summary, project health, export readiness, and exact export. Visible root
diagnostics remain semantic and contain no private execution identifiers.

No dependency, package, modeling row, project schema, `.wcad` version,
persistence field, or renderer authority was added.

## Checks

- `@web-cad/cad-protocol` V21 exact-export protocol: 7 tests passed.
- `@web-cad/cad-core` V21 planning/parity: 10 tests passed; existing project
  summary compatibility: 3 tests passed.
- `@web-cad/web` resolver, projection, display, exact metadata, query, and scene
  parity: 172 tests passed across 6 files.
- `@web-cad/geometry-worker`: 58 tests passed.
- Protocol, cad-core, and web typechecks passed.
- `git diff --check` passed.

Gate F is complete. Slice G may harden rebuild, history, storage, and
concurrency around this projection; it may not persist derived exact output or
add another exact-result authority.
