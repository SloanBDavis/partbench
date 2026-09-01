# V21 Gate B Exact Export Planning Evidence

Recorded: **2026-08-01**  
Protocol commit: `7069c53a1f55c0be6e515e04a2ac5cd21d789569`  
Cad-core commit: `55b1aedceabd32d6592ca4b0a244fe62536e0b68`  
Adapter commit: `21d935be9dbbf96c1e810dd93878320bf10ed109`

## Result

The existing `project.exportReadiness`, `project.exportExact`,
`project.summary`, and `project.health` query path now produces one
deterministic, identity-bound AP242 export plan without geometry or file bytes.
Omitted and empty filters select active bodies in canonical body-ID order;
explicit filters retain caller order. Missing and consumed selections block,
while duplicate, empty, malformed, and over-limit selections fail at the shared
protocol validator. Plans are all-or-nothing and bind document units, canonical
project source identity, ordered IDs, trimmed authored names or deterministic ID
fallbacks, and per-body source identity signatures.

All 13 current `CadBodySource["type"]` members have a compile-time exhaustive
source-kind and feature-kind policy. Source eligibility is separate from
current exact readiness: eligible bodies without matching browser-derived
evidence report `pending`, mismatched evidence reports `stale`, and invalid,
failed, or completed-matrix-excluded evidence reports the corresponding
blocked state. Export-all cannot silently omit a blocked active body, and a
ready explicit subset is independent of unrelated bodies.

Agent, MCP, and V20 loopback projections expose the same plan, current statuses,
and diagnostics. They do not expose B-rep/STEP bytes, browser handles, paths,
renderer/mesh/OCCT/worker IDs, or cache IDs. The in-memory adapter reports
eligible bodies as pending until the browser provides current exact evidence;
V20 approval modes and transport behavior are unchanged.

Deprecated export recipes and the historical artifact response remain readable
for compatibility, but neither authorizes V21 export. Geometry resolution and
file writing remain intentionally absent from Gate B and begin at Slices C-E.

## Checks

- `@web-cad/cad-protocol`: 90 tests passed; typecheck passed.
- `@web-cad/cad-core`: 1,111 tests passed across 55 files; typecheck passed.
- `@web-cad/agent-adapter`: 118 tests passed; typecheck passed.
- `@web-cad/mcp-adapter`: 87 tests passed; typecheck passed.
- `@web-cad/mcp-stdio-server`: 29 tests passed across 7 files; typecheck passed.
- Prettier and `git diff --check` passed.

Gate B is complete. Public planning is deterministic and truthful without
requiring geometry, browser state, or file-writing authority.
